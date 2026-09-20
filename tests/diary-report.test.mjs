import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiaryReport, EXPORT_RANGES } from '../src/utils/diaryReport.js';

const pages = [
  { id: 'today-page', page_date: '2026-09-20', page_no: 1, title: 'مراجعة اليوم' },
  { id: 'past-page', page_date: '2026-09-19', page_no: 1, title: 'أمس' },
];

const blocks = [
  { id: 'later', page_id: 'today-page', kind: 'task', content: 'المهمة الثانية', due_date: '2026-09-20', task_order: 2, status: 'done', is_completed: true, completed_at: '2026-09-20T10:30:00.000Z' },
  { id: 'first', page_id: 'past-page', kind: 'task', content: 'المهمة الأولى', due_date: '2026-09-20', task_order: 1, status: 'done', is_completed: true, completed_at: '2026-09-20T08:10:00.000Z', description: 'تفاصيل المهمة الأولى' },
  { id: 'past', page_id: 'past-page', kind: 'task', content: 'مهمة الأمس', due_date: '2026-09-19', status: 'pending' },
  { id: 'text', page_id: 'today-page', kind: 'text', content: '<strong>ملاحظة</strong><br>مكتوبة' },
  { id: 'trashed', page_id: 'today-page', kind: 'task', content: 'لا تظهر', due_date: '2026-09-20', deleted_at: '2026-09-20T12:00:00.000Z' },
  { id: 'goal', page_id: 'past-page', kind: 'task', content: 'هدف طويل', is_pinned: true, progress: 40, progress_entries: [{ id: 'progress', progress: 40, note: 'تقدم جديد' }] },
  { id: 'moved', page_id: 'past-page', kind: 'task', content: 'مهمة مؤجلة', due_date: '2026-09-20', task_order: 3, task_events: [{ id: 'move', type: 'rescheduled', from_date: '2026-09-19', to_date: '2026-09-20', created_at: '2026-09-20T09:00:00.000Z' }] },
  { id: 'late', page_id: 'past-page', kind: 'task', content: 'مهمة أُنجزت متأخرة', due_date: '2026-09-18', status: 'done', is_completed: true, completed_at: '2026-09-20T11:20:00.000Z' },
];

const data = { pages, blocks, countdowns: [] };

test('today report includes off-page due tasks in saved order, descriptions, notes, and completion sequence', () => {
  const report = buildDiaryReport(data, { range: EXPORT_RANGES.today }, '2026-09-20');
  assert.equal(report.reportDays.length, 1);
  const day = report.reportDays[0];
  assert.deepEqual(day.tasks.map((task) => task.title), ['المهمة الأولى', 'المهمة الثانية', 'مهمة مؤجلة']);
  assert.equal(day.tasks[0].description, 'تفاصيل المهمة الأولى');
  assert.equal(day.tasks[0].completedOrder, 1);
  assert.equal(day.tasks[1].completedOrder, 2);
  assert.deepEqual(day.notes[0].lines, ['ملاحظة\nمكتوبة']);
  assert.equal(day.tasks.some((task) => task.title === 'لا تظهر'), false);
  assert.equal(day.lateCompletedTasks[0].title, 'مهمة أُنجزت متأخرة');
  assert.equal(day.lateCompletedTasks[0].completedOrder, 3);
});

test('recent report includes each requested day and shows the postponement on its original day', () => {
  const report = buildDiaryReport(data, { range: EXPORT_RANGES.recent, days: 2 }, '2026-09-20');
  assert.deepEqual(report.reportDays.map((day) => day.key), ['2026-09-20', '2026-09-19']);
  assert.equal(report.reportDays[1].postponedTasks[0].title, 'مهمة مؤجلة');
});

test('full report includes all dated diary entries plus pinned goals', () => {
  const report = buildDiaryReport(data, { range: EXPORT_RANGES.all }, '2026-09-20');
  assert.deepEqual(report.reportDays.map((day) => day.key), ['2026-09-20', '2026-09-19', '2026-09-18']);
  assert.equal(report.pinnedGoals[0].title, 'هدف طويل');
  assert.equal(report.pinnedGoals[0].progress_entries[0].note, 'تقدم جديد');
});
