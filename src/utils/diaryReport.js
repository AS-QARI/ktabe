import { formatDateWithYear, parseDateKey, shiftDateKey, toDateKey, todayKey } from './dates.js';

export const EXPORT_RANGES = {
  today: 'today',
  recent: 'recent',
  all: 'all',
};

const STATUS_LABELS = {
  pending: 'لم تبدأ',
  in_progress: 'قيد العمل',
  done: 'مكتملة',
  postponed: 'مؤجلة',
};

function taskOrder(task) {
  return Number(task.task_order ?? task.position ?? 0);
}

function timestampDateKey(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : toDateKey(date);
}

export function plainText(value = '') {
  return String(value)
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\u200b/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sortedByTaskOrder(tasks) {
  return [...tasks].sort((a, b) =>
    taskOrder(a) - taskOrder(b) || new Date(a.created_at || 0) - new Date(b.created_at || 0)
  );
}

function orderedTasks(tasks) {
  const ids = new Set(tasks.map((task) => task.id));
  const children = new Map();
  const roots = [];

  for (const task of tasks) {
    if (task.parent_id && ids.has(task.parent_id)) {
      if (!children.has(task.parent_id)) children.set(task.parent_id, []);
      children.get(task.parent_id).push(task);
    } else {
      roots.push(task);
    }
  }

  const output = [];
  const seen = new Set();
  const append = (task, depth) => {
    if (seen.has(task.id)) return;
    seen.add(task.id);
    output.push({ ...task, depth });
    sortedByTaskOrder(children.get(task.id) ?? []).forEach((child) => append(child, depth + 1));
  };

  sortedByTaskOrder(roots).forEach((task) => append(task, 0));
  sortedByTaskOrder(tasks).forEach((task) => append(task, 0));
  return output;
}

function dateKeysForRange(data, range, days, endDate) {
  if (range === EXPORT_RANGES.all) {
    const pageDates = data.pages.map((page) => page.page_date).filter(Boolean);
    const pageDateById = new Map(data.pages.map((page) => [page.id, page.page_date]));
    const taskDates = data.blocks
      .filter((block) => block.kind === 'task' && !block.deleted_at && !block.is_pinned)
      .map((task) => task.due_date ?? pageDateById.get(task.page_id))
      .filter(Boolean);
    const postponedDates = data.blocks
      .flatMap((block) => block.task_events || [])
      .filter((event) => event.type === 'rescheduled')
      .map((event) => event.from_date)
      .filter(Boolean);
    const completedDates = data.blocks
      .filter((block) => block.kind === 'task' && !block.deleted_at && !block.is_pinned)
      .map((task) => timestampDateKey(task.completed_at))
      .filter(Boolean);
    return [...new Set([...pageDates, ...taskDates, ...postponedDates, ...completedDates])]
      .sort((a, b) => b.localeCompare(a));
  }

  const count = range === EXPORT_RANGES.recent ? Math.max(1, Math.min(Number(days) || 7, 90)) : 1;
  return Array.from({ length: count }, (_, index) => shiftDateKey(endDate, -index));
}

function reportTitle(range, days) {
  if (range === EXPORT_RANGES.all) return 'السجل الكامل لليوميات والمهمات';
  if (range === EXPORT_RANGES.recent) return `ملخص آخر ${Math.max(1, Math.min(Number(days) || 7, 90))} أيام`;
  return 'ملخص اليوم';
}

function reportNotes(pages, blocksByPage) {
  return pages
    .map((page) => ({
      id: page.id,
      title: plainText(page.title),
      lines: (blocksByPage.get(page.id) ?? [])
        .filter((block) => block.kind !== 'task' && !block.deleted_at)
        .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
        .map((block) => plainText(block.content))
        .filter(Boolean),
    }))
    .filter((note) => note.title || note.lines.length);
}

function taskReport(task, index, completedOrder) {
  const status = task.status || (task.is_completed ? 'done' : 'pending');
  return {
    ...task,
    index,
    title: plainText(task.content) || 'مهمة بلا عنوان',
    status,
    statusLabel: STATUS_LABELS[status] ?? STATUS_LABELS.pending,
    completedOrder: completedOrder.get(task.id) ?? null,
    completedDate: timestampDateKey(task.completed_at),
    description: plainText(task.description),
  };
}

/** يبني بيانات تقرير الطباعة من البيانات المحلية من دون أي كتابة أو تغيير. */
export function buildDiaryReport(data, selection = {}, endDate = todayKey()) {
  const range = Object.values(EXPORT_RANGES).includes(selection.range)
    ? selection.range
    : EXPORT_RANGES.today;
  const days = Math.max(1, Math.min(Number(selection.days) || 7, 90));
  const pageDateById = new Map(data.pages.map((page) => [page.id, page.page_date]));
  const pagesByDate = new Map();
  const blocksByPage = new Map();

  for (const page of data.pages) {
    if (!pagesByDate.has(page.page_date)) pagesByDate.set(page.page_date, []);
    pagesByDate.get(page.page_date).push(page);
  }
  for (const block of data.blocks) {
    if (!blocksByPage.has(block.page_id)) blocksByPage.set(block.page_id, []);
    blocksByPage.get(block.page_id).push(block);
  }

  const dayTasks = new Map();
  const pinnedGoals = [];
  const postponedByDate = new Map();
  const completedByDate = new Map();
  for (const task of data.blocks.filter((block) => block.kind === 'task' && !block.deleted_at)) {
    if (task.is_pinned) {
      pinnedGoals.push(task);
      continue;
    }
    const key = task.due_date ?? pageDateById.get(task.page_id);
    if (!key) continue;
    if (!dayTasks.has(key)) dayTasks.set(key, []);
    dayTasks.get(key).push(task);

    const completionKey = timestampDateKey(task.completed_at);
    if (completionKey && (task.status === 'done' || task.is_completed)) {
      if (!completedByDate.has(completionKey)) completedByDate.set(completionKey, []);
      completedByDate.get(completionKey).push(task);
    }

    for (const event of task.task_events || []) {
      if (event.type !== 'rescheduled' || !event.from_date) continue;
      if (!postponedByDate.has(event.from_date)) postponedByDate.set(event.from_date, []);
      postponedByDate.get(event.from_date).push({ task, event });
    }
  }

  const dateKeys = dateKeysForRange(data, range, days, endDate);
  const reportDays = dateKeys.map((key) => {
    const ordered = orderedTasks(dayTasks.get(key) ?? []);
    const completedThatDay = [...(completedByDate.get(key) ?? [])].sort((a, b) =>
      new Date(a.completed_at) - new Date(b.completed_at) || taskOrder(a) - taskOrder(b)
    );
    const completedOrder = new Map(
      completedThatDay
        .map((task, index) => [task.id, index + 1])
    );
    const tasks = ordered.map((task, index) => taskReport(task, index + 1, completedOrder));
    const lateCompletedTasks = completedThatDay
      .filter((task) => (task.due_date ?? pageDateById.get(task.page_id)) !== key)
      .map((task, index) => ({
        ...taskReport(task, index + 1, completedOrder),
        plannedDate: task.due_date ?? pageDateById.get(task.page_id),
      }));
    const done = tasks.filter((task) => task.status === 'done' || task.is_completed).length;
    const postponed = tasks.filter((task) => task.status === 'postponed').length;

    return {
      key,
      date: parseDateKey(key),
      pages: [...(pagesByDate.get(key) ?? [])].sort((a, b) => Number(a.page_no || 0) - Number(b.page_no || 0)),
      notes: reportNotes(pagesByDate.get(key) ?? [], blocksByPage),
      tasks,
      lateCompletedTasks,
      postponedTasks: (postponedByDate.get(key) ?? []).map(({ task, event }) => ({
        id: `${task.id}-${event.id}`,
        title: plainText(task.content) || 'مهمة بلا عنوان',
        toDate: event.to_date,
        createdAt: event.created_at,
      })),
      totals: { total: tasks.length, done, postponed, remaining: tasks.length - done },
    };
  });

  return {
    title: reportTitle(range, days),
    range,
    days,
    generatedAt: new Date(),
    reportDays,
    pinnedGoals: sortedByTaskOrder(pinnedGoals).map((task, index) => taskReport(task, index + 1, new Map())),
    totalTasks: new Set(reportDays.flatMap((day) => [
      ...day.tasks.map((task) => task.id),
      ...day.lateCompletedTasks.map((task) => task.id),
    ])).size,
    formattedEndDate: formatDateWithYear(parseDateKey(endDate)),
  };
}
