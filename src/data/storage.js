import { readOfflineSnapshot } from '../lib/offlineCache';

/*
 * طبقة البيانات المحلية لكتابي.
 * كل شيء يُحفظ داخل IndexedDB في هذا المتصفح فقط؛ لا توجد شبكة أو حسابات
 * أو مزامنة خارجية. بقيت الواجهة البرمجية Async حتى لا تحتاج الشاشات لأي
 * تغيير، وحتى يظل العمل سلساً لو كبرت اليوميات مع الوقت.
 */

const DB_NAME = 'kitabi-local';
const DB_VERSION = 2;
const localEvents = new EventTarget();
const channel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('kitabi-local-changes')
  : null;

let databasePromise;
let migrationPromise;
let taskDueDateMigrationPromise;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('تعذّر الوصول إلى التخزين المحلي'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('تعذّر حفظ البيانات محلياً'));
    transaction.onabort = () => reject(transaction.error || new Error('أُلغيت عملية الحفظ المحلية'));
  });
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('pages')) {
        const pages = db.createObjectStore('pages', { keyPath: 'id' });
        pages.createIndex('page_date', 'page_date');
        pages.createIndex('updated_at', 'updated_at');
      } else {
        const pages = open.transaction.objectStore('pages');
        if (!pages.indexNames.contains('updated_at')) pages.createIndex('updated_at', 'updated_at');
      }
      if (!db.objectStoreNames.contains('blocks')) {
        const blocks = db.createObjectStore('blocks', { keyPath: 'id' });
        blocks.createIndex('page_id', 'page_id');
        blocks.createIndex('due_date', 'due_date');
      }
      if (!db.objectStoreNames.contains('countdowns')) {
        db.createObjectStore('countdowns', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error || new Error('تعذّر فتح التخزين المحلي'));
    open.onblocked = () => reject(new Error('أغلق نوافذ كتابي القديمة ثم أعد المحاولة'));
  });
  return databasePromise;
}

async function getRaw(storeName, key) {
  const db = await openDatabase();
  return requestResult(db.transaction(storeName).objectStore(storeName).get(key));
}

async function getAllRaw(storeName) {
  const db = await openDatabase();
  return requestResult(db.transaction(storeName).objectStore(storeName).getAll());
}

async function getAllFromIndex(storeName, indexName, query) {
  const db = await openDatabase();
  const store = db.transaction(storeName).objectStore(storeName);
  return requestResult(store.index(indexName).getAll(query));
}

async function putRaw(storeName, value) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(value);
  await transactionDone(tx);
  return value;
}

async function deleteRaw(storeName, key) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).delete(key);
  await transactionDone(tx);
}

function makeId() {
  return crypto.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function announce(table) {
  localEvents.dispatchEvent(new CustomEvent('change', { detail: table }));
  channel?.postMessage(table);
}

channel?.addEventListener('message', (event) => {
  localEvents.dispatchEvent(new CustomEvent('change', { detail: event.data }));
});

/** يستورد آخر لقطة محلية من النسخة القديمة مرة واحدة، بلا اتصال خارجي. */
async function migrateLegacySnapshot() {
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    const migrated = await getRaw('settings', 'legacy-snapshot-migrated');
    if (migrated) return;

    const [existingPages, existingBlocks] = await Promise.all([
      getAllRaw('pages'),
      getAllRaw('blocks'),
    ]);
    const snapshot = readOfflineSnapshot();
    if (existingPages.length === 0 && existingBlocks.length === 0 && snapshot?.pages && snapshot?.blocks) {
      const db = await openDatabase();
      const tx = db.transaction(['pages', 'blocks', 'countdowns'], 'readwrite');
      const pagesStore = tx.objectStore('pages');
      const blocksStore = tx.objectStore('blocks');
      const countdownsStore = tx.objectStore('countdowns');
      snapshot.pages.forEach((page) => {
        const { blocks: _embeddedBlocks, ...cleanPage } = page;
        pagesStore.put(cleanPage);
      });
      snapshot.blocks.forEach((block) => blocksStore.put(block));
      (snapshot.countdowns ?? []).forEach((countdown) => countdownsStore.put(countdown));
      await transactionDone(tx);
    }
    await putRaw('settings', { key: 'legacy-snapshot-migrated', value: true, updated_at: nowIso() });
  })();
  return migrationPromise;
}

/**
 * الإصدارات القديمة كانت تسمح بمهمة بلا due_date وتعتمد على تاريخ الصفحة.
 * نملأه مرة واحدة كي نستطيع لاحقاً استخدام فهرس due_date بدلاً من مسح كل
 * الكتل في كل فتح لصفحة اليوم.
 */
async function migrateTaskDueDates() {
  if (taskDueDateMigrationPromise) return taskDueDateMigrationPromise;
  taskDueDateMigrationPromise = (async () => {
    const migrated = await getRaw('settings', 'task-due-date-migrated-v1');
    if (migrated) return;

    const [pages, blocks] = await Promise.all([getAllRaw('pages'), getAllRaw('blocks')]);
    const pageDateById = new Map(pages.map((page) => [page.id, page.page_date]));
    const missingDates = blocks.filter(
      (block) => block.kind === 'task' && !block.due_date && pageDateById.has(block.page_id)
    );

    if (missingDates.length) {
      const db = await openDatabase();
      const tx = db.transaction(['blocks', 'settings'], 'readwrite');
      const blockStore = tx.objectStore('blocks');
      for (const block of missingDates) {
        blockStore.put({ ...block, due_date: pageDateById.get(block.page_id), updated_at: nowIso() });
      }
      tx.objectStore('settings').put({
        key: 'task-due-date-migrated-v1',
        value: true,
        updated_at: nowIso(),
      });
      await transactionDone(tx);
      announce('blocks');
      return;
    }

    await putRaw('settings', {
      key: 'task-due-date-migrated-v1',
      value: true,
      updated_at: nowIso(),
    });
  })();
  return taskDueDateMigrationPromise;
}

async function ready() {
  await openDatabase();
  await migrateLegacySnapshot();
  await migrateTaskDueDates();
}

async function hashPin(pin, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${pin}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validPin(pin) {
  return /^\d{4,6}$/.test(pin || '');
}

function randomSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hasPin() {
  await ready();
  return Boolean(await getRaw('settings', 'pin'));
}

export async function setupPin(pin) {
  await ready();
  if (!validPin(pin) || await getRaw('settings', 'pin')) return false;
  const salt = randomSalt();
  await putRaw('settings', { key: 'pin', salt, hash: await hashPin(pin, salt), updated_at: nowIso() });
  announce('settings');
  return true;
}

export async function verifyPin(pin) {
  await ready();
  const saved = await getRaw('settings', 'pin');
  if (!saved || !validPin(pin)) return false;
  const matches = (await hashPin(pin, saved.salt)) === saved.hash;
  if (!matches) await new Promise((resolve) => window.setTimeout(resolve, 300));
  return matches;
}

export async function changePin(oldPin, newPin) {
  if (!validPin(newPin) || !(await verifyPin(oldPin))) return false;
  const salt = randomSalt();
  await putRaw('settings', { key: 'pin', salt, hash: await hashPin(newPin, salt), updated_at: nowIso() });
  announce('settings');
  return true;
}

async function pagesWithBlocks() {
  await ready();
  const [pages, blocks] = await Promise.all([getAllRaw('pages'), getAllRaw('blocks')]);
  return joinPagesAndBlocks(pages, blocks);
}

function joinPagesAndBlocks(pages, blocks) {
  const byPage = new Map();
  for (const block of blocks) {
    if (!byPage.has(block.page_id)) byPage.set(block.page_id, []);
    byPage.get(block.page_id).push(block);
  }
  return pages.map((page) => ({
    ...page,
      blocks: (byPage.get(page.id) ?? []).sort((a, b) => Number(a.position || 0) - Number(b.position || 0)),
  }));
}

export async function getDayPages(dateKey) {
  await ready();
  const pages = await getAllFromIndex('pages', 'page_date', IDBKeyRange.only(dateKey));
  const blocksByPage = await Promise.all(
    pages.map((page) => getAllFromIndex('blocks', 'page_id', IDBKeyRange.only(page.id)))
  );
  return joinPagesAndBlocks(pages, blocksByPage.flat())
    .sort((a, b) => Number(a.page_no || 0) - Number(b.page_no || 0));
}

/** مهام اليوم وما قبله — مسار خفيف لشاشة «يومي»، مبني على فهرس الموعد. */
export async function getAgendaTasks(dateKey) {
  await ready();
  const blocks = await getAllFromIndex('blocks', 'due_date', IDBKeyRange.upperBound(dateKey));
  return blocks.filter((block) => block.kind === 'task' && !block.deleted_at);
}

/** الأيام القريبة التي تحمل كتابة؛ تُستخدم فقط لنقاط شريط الأيام السبعة. */
export async function getWrittenDayKeys(startDateKey, endDateKey) {
  await ready();
  const pages = await getAllFromIndex(
    'pages',
    'page_date',
    IDBKeyRange.bound(startDateKey, endDateKey)
  );
  const blocksByPage = await Promise.all(
    pages.map((page) => getAllFromIndex('blocks', 'page_id', IDBKeyRange.only(page.id)))
  );
  const keys = new Set();
  pages.forEach((page, index) => {
    const written = Boolean(page.title?.trim()) || blocksByPage[index].some((block) => {
      const text = String(block.content ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim();
      return text.length > 0;
    });
    if (written) keys.add(page.page_date);
  });
  return [...keys];
}

export async function listAllPages() {
  return (await pagesWithBlocks()).sort((a, b) =>
    b.page_date.localeCompare(a.page_date) || Number(a.page_no || 0) - Number(b.page_no || 0)
  );
}

/**
 * بيانات شاشتي التقويم والملخص: تحتاج كل الصفحات وكل المهام فقط، لا نصوص
 * الملاحظات الحرة. القراءة من فهرس due_date تمنع سحب آلاف الكتل النصية.
 */
export async function getProductivityData() {
  await ready();
  const [pages, blocks, countdowns] = await Promise.all([
    getAllRaw('pages'),
    getAllFromIndex('blocks', 'due_date'),
    getAllRaw('countdowns'),
  ]);
  return {
    pages,
    blocks: blocks.filter((block) => block.kind === 'task'),
    countdowns,
  };
}

export async function createPage(dateKey, pageNo) {
  await ready();
  const stamp = nowIso();
  const page = {
    id: makeId(),
    page_date: dateKey,
    page_no: pageNo,
    title: '',
    text_size: 'md',
    is_pinned: false,
    pinned_at: null,
    created_at: stamp,
    updated_at: stamp,
  };
  await putRaw('pages', page);
  announce('pages');
  return page;
}

export async function updatePage(id, patch) {
  await ready();
  const page = await getRaw('pages', id);
  if (!page) throw new Error('الصفحة غير موجودة');
  const updated = { ...page, ...patch, id, updated_at: nowIso() };
  await putRaw('pages', updated);
  announce('pages');
  return updated;
}

export async function deletePage(id) {
  await ready();
  const db = await openDatabase();
  const tx = db.transaction(['pages', 'blocks'], 'readwrite');
  tx.objectStore('pages').delete(id);
  const blocksStore = tx.objectStore('blocks');
  const blocks = await requestResult(blocksStore.index('page_id').getAll(id));
  blocks.forEach((block) => blocksStore.delete(block.id));
  await transactionDone(tx);
  announce('pages');
  announce('blocks');
}

export async function createBlock(fields) {
  await ready();
  const stamp = nowIso();
  const block = {
    id: makeId(),
    parent_id: null,
    kind: 'text',
    content: '',
    is_completed: false,
    completed_at: null,
    position: 0,
    due_date: null,
    priority: 0,
    repeat_rule: 'none',
    reminder_at: null,
    deleted_at: null,
    status: 'pending',
    created_at: stamp,
    updated_at: stamp,
    ...fields,
  };
  await putRaw('blocks', block);
  announce('blocks');
  return block;
}

export async function updateBlock(id, patch) {
  await ready();
  const block = await getRaw('blocks', id);
  if (!block) throw new Error('المهمة أو السطر غير موجود');
  const updated = { ...block, ...patch, id, updated_at: nowIso() };
  await putRaw('blocks', updated);
  announce('blocks');
  return updated;
}

export async function trashBlock(id) {
  return updateBlock(id, { deleted_at: nowIso() });
}

export async function restoreBlock(id) {
  return updateBlock(id, { deleted_at: null });
}

export async function listTrashedBlocks() {
  await ready();
  const [blocks, pages] = await Promise.all([getAllRaw('blocks'), getAllRaw('pages')]);
  const pageMap = new Map(pages.map((page) => [page.id, page]));
  return blocks
    .filter((block) => block.deleted_at)
    .sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at))
    .map((block) => {
      const page = pageMap.get(block.page_id);
      return {
        ...block,
        pages: page ? { page_date: page.page_date, page_no: page.page_no, title: page.title } : null,
      };
    });
}

function nextRepeatDate(dateKey, rule) {
  if (!dateKey || !rule || rule === 'none') return null;
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (rule === 'daily') date.setDate(date.getDate() + 1);
  if (rule === 'weekly') date.setDate(date.getDate() + 7);
  if (rule === 'monthly') date.setMonth(date.getMonth() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const TASK_STATUSES = ['pending', 'in_progress', 'done'];

export const TASK_STATUS_LABELS = {
  pending: 'لم تبدأ',
  in_progress: 'شغال عليها',
  done: 'مكتملة',
  postponed: 'مؤجلة',
};

export function nextTaskStatus(status) {
  const index = TASK_STATUSES.indexOf(status || 'pending');
  return TASK_STATUSES[(index + 1) % TASK_STATUSES.length];
}

export async function setBlockStatus(block, status) {
  const done = status === 'done';
  const updated = await updateBlock(block.id, {
    status,
    is_completed: done,
    completed_at: done ? nowIso() : null,
  });
  if (!done || !block.repeat_rule || block.repeat_rule === 'none') {
    return { updated, repeated: null };
  }
  const dueDate = nextRepeatDate(block.due_date, block.repeat_rule);
  if (!dueDate) return { updated, repeated: null };
  const repeated = await createBlock({
    page_id: block.page_id,
    kind: 'task',
    content: block.content,
    position: Number(block.position || 0) + 0.01,
    due_date: dueDate,
    priority: block.priority || 0,
    repeat_rule: block.repeat_rule,
  });
  return { updated, repeated };
}

export async function deleteBlock(id) {
  await ready();
  const blocks = await getAllRaw('blocks');
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const block of blocks) {
      if (block.parent_id && ids.has(block.parent_id) && !ids.has(block.id)) {
        ids.add(block.id);
        changed = true;
      }
    }
  }
  const db = await openDatabase();
  const tx = db.transaction('blocks', 'readwrite');
  ids.forEach((blockId) => tx.objectStore('blocks').delete(blockId));
  await transactionDone(tx);
  announce('blocks');
}

export async function listCountdowns() {
  await ready();
  return (await getAllRaw('countdowns')).sort((a, b) => a.target_date.localeCompare(b.target_date));
}

export async function createCountdown(fields) {
  await ready();
  const countdown = { id: makeId(), created_at: nowIso(), ...fields };
  await putRaw('countdowns', countdown);
  announce('countdowns');
  return countdown;
}

export async function updateCountdown(id, fields) {
  await ready();
  const current = await getRaw('countdowns', id);
  if (!current) throw new Error('العداد غير موجود');
  const updated = { ...current, ...fields, id, created_at: current.created_at };
  await putRaw('countdowns', updated);
  announce('countdowns');
  return updated;
}

export async function deleteCountdown(id) {
  await ready();
  await deleteRaw('countdowns', id);
  announce('countdowns');
}

export async function exportAll() {
  await ready();
  const [pages, blocks, countdowns] = await Promise.all([
    getAllRaw('pages'),
    getAllRaw('blocks'),
    getAllRaw('countdowns'),
  ]);
  return {
    app: 'kitabi',
    version: 2,
    storage: 'local-indexeddb',
    exported_at: nowIso(),
    pages: pages.sort((a, b) => a.page_date.localeCompare(b.page_date) || a.page_no - b.page_no),
    blocks: blocks.sort((a, b) => Number(a.position || 0) - Number(b.position || 0)),
    countdowns: countdowns.sort((a, b) => a.target_date.localeCompare(b.target_date)),
  };
}

export async function importAll(backup) {
  if (
    !backup ||
    backup.app !== 'kitabi' ||
    backup.version !== 2 ||
    !Array.isArray(backup.pages) ||
    !Array.isArray(backup.blocks) ||
    !Array.isArray(backup.countdowns)
  ) {
    throw new Error('الملف ليس نسخة احتياطية صالحة من كتابي');
  }
  await ready();
  const db = await openDatabase();
  const tx = db.transaction(['pages', 'blocks', 'countdowns'], 'readwrite');
  for (const name of ['pages', 'blocks', 'countdowns']) tx.objectStore(name).clear();
  backup.pages.forEach((page) => {
    const { blocks: _embeddedBlocks, ...cleanPage } = page;
    tx.objectStore('pages').put(cleanPage);
  });
  backup.blocks.forEach((block) => tx.objectStore('blocks').put(block));
  backup.countdowns.forEach((countdown) => tx.objectStore('countdowns').put(countdown));
  await transactionDone(tx);
  announce('pages');
  announce('blocks');
  announce('countdowns');
}

/** إشعار محلي للشاشات والتبويبات الأخرى في المتصفح نفسه. */
export function onTablesChange(tables, onChange) {
  const handler = (event) => {
    if (tables.includes(event.detail)) onChange();
  };
  localEvents.addEventListener('change', handler);
  return () => localEvents.removeEventListener('change', handler);
}
