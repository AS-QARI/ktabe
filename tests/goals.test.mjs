import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
// Node's BroadcastChannel would keep the test process alive.
globalThis.BroadcastChannel = undefined;
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => null }, configurable: true });
const storage = await import('../src/data/storage.js');
const { createPage, createBlock, updateBlock, saveTaskDetails, getAgendaTasks, setBlockStatus, exportAll, importAll, trashBlock, restoreBlock } = storage;
const page = await createPage('2026-09-19', 1);
const create = (fields = {}) => createBlock({ page_id: page.id, kind: 'task', content: 'هدف تجريبي', due_date: '2026-09-19', ...fields });
const details = (overrides = {}) => ({ description: 'وصف عربي', is_pinned: true, progress: 25, note: 'أول خطوة', ...overrides });

test('goals appear across days including before original due date', async () => {
  const task = await create({ due_date: '2027-01-01' });
  await saveTaskDetails(task.id, details());
  assert.ok((await getAgendaTasks('2026-09-18')).some(t => t.id === task.id));
  assert.ok((await getAgendaTasks('2027-02-01')).some(t => t.id === task.id));
});
test('progress history appends notes, percentage-only changes and unchanged-percent updates', async () => {
  const task = await create();
  await saveTaskDetails(task.id, details());
  await saveTaskDetails(task.id, details({ progress: 50, note: '' }));
  const updated = await saveTaskDetails(task.id, details({ progress: 50, note: 'راجعت الخطة' }));
  assert.deepEqual(updated.progress_entries.map(e => e.progress), [25, 50, 50]);
  assert.equal(updated.progress_entries[2].note, 'راجعت الخطة');
  assert.equal(updated.status, 'in_progress');
  const noChange = await saveTaskDetails(task.id, details({ progress: 50, note: '' }));
  assert.equal(noChange.progress_entries.length, 3);
});
test('concurrent edits preserve every progress entry and renamed title', async () => {
  const task = await create();
  await Promise.all([
    saveTaskDetails(task.id, details({ note: 'أ' })),
    updateBlock(task.id, { content: 'اسم جديد' }),
    saveTaskDetails(task.id, details({ progress: 60, note: 'ب' })),
  ]);
  const updated = (await exportAll()).blocks.find(t => t.id === task.id);
  assert.equal(updated.content, 'اسم جديد');
  assert.deepEqual(updated.progress_entries.map(e => e.note), ['أ', 'ب']);
});
test('completion, reopening and unpinning retain history without repeating', async () => {
  const task = await create({ repeat_rule: 'weekly' });
  const done = await saveTaskDetails(task.id, details({ progress: 100 }));
  assert.equal(done.is_completed, true);
  assert.ok(done.completed_at);
  assert.equal(done.repeat_rule, 'none');
  const reopened = await saveTaskDetails(task.id, details({ progress: 40 }));
  assert.equal(reopened.completed_at, null);
  assert.equal(reopened.status, 'in_progress');
  const unpinned = await saveTaskDetails(task.id, details({ is_pinned: false, progress: 40, note: '' }));
  assert.equal(unpinned.progress_entries.length, 2);
  assert.equal(unpinned.due_date, '2026-09-19');
  assert.ok(!(await getAgendaTasks('2026-09-18')).some(t => t.id === task.id));
});
test('invalid percentages are rejected without writing', async () => {
  const task = await create();
  for (const progress of [-1, 101, 3.5, NaN]) await assert.rejects(saveTaskDetails(task.id, details({ progress })));
  assert.equal((await exportAll()).blocks.find(t => t.id === task.id).progress_entries.length, 0);
});
test('legacy tasks and description-only updates preserve existing status', async () => {
  const task = await create({ status: 'in_progress', progress: undefined, progress_entries: undefined });
  const saved = await saveTaskDetails(task.id, details({ is_pinned: false, progress: 0, note: '' }));
  assert.equal(saved.status, 'in_progress');
  assert.equal(saved.description, 'وصف عربي');
  assert.deepEqual(saved.progress_entries, []);
});
test('status changes synchronize goal progress and retain repeated task descriptions', async () => {
  const task = await create();
  const pinned = await saveTaskDetails(task.id, details());
  const { updated, repeated } = await setBlockStatus(pinned, 'done');
  assert.equal(updated.progress, 100);
  assert.equal(updated.progress_entries.length, 2);
  assert.equal(repeated, null);
  const daily = await create({ description: 'وصف متكرر', repeat_rule: 'daily' });
  const result = await setBlockStatus(daily, 'done');
  assert.equal(result.repeated.description, daily.description);
  assert.equal(result.repeated.is_pinned, false);
  assert.equal(result.repeated.progress, 0);
});
test('trash, restore and JSON backup round trip preserve goals and history', async () => {
  const task = await create();
  const goal = await saveTaskDetails(task.id, details());
  await trashBlock(task.id);
  assert.ok(!(await getAgendaTasks('2026-09-19')).some(t => t.id === task.id));
  await restoreBlock(task.id);
  const backup = JSON.parse(JSON.stringify(await exportAll()));
  await importAll(backup);
  const restored = (await getAgendaTasks('2026-09-19')).find(t => t.id === task.id);
  assert.equal(restored.description, goal.description);
  assert.equal(restored.is_pinned, true);
  assert.deepEqual(restored.progress_entries, goal.progress_entries);
});
