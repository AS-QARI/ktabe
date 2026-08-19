import { useMemo, useRef, useState } from 'react';
import {
  exportAll,
  setBlockStatus,
  nextTaskStatus,
  TASK_STATUS_LABELS,
  createCountdown,
  deleteCountdown,
  createPage,
  createBlock,
  updateBlock,
} from '../data/storage';
import { useLiveData } from '../hooks/useLiveData';
import {
  buildMonthGrid,
  weekdayNames,
  formatMonthYear,
  formatFullDate,
  todayKey,
  relativeDayLabel,
  diffDaysBetweenKeys,
  parseDateKey,
} from '../utils/dates';
import { daysAr } from '../utils/format';
import CountdownModal from '../components/countdowns/CountdownModal';
import Modal from '../components/ui/Modal';
import {
  GearIcon,
  PlusIcon,
  CheckIcon,
  PostponedIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
} from '../components/ui/Icons';
import './screens.css';
import './CalendarScreen.css';

const ALL_TABLES = ['pages', 'blocks', 'countdowns'];
const WEEKDAYS = weekdayNames();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function keyFromTimestamp(value) {
  if (!value) return todayKey();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return todayKey();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function countdownMeta(countdown, today) {
  const diff = diffDaysBetweenKeys(today, countdown.target_date);
  const state = diff > 0 ? 'future' : diff === 0 ? 'now' : 'past';
  const startKey = keyFromTimestamp(countdown.created_at);
  const total = Math.max(1, diffDaysBetweenKeys(startKey, countdown.target_date));
  const elapsed = clamp(diffDaysBetweenKeys(startKey, today), 0, total);
  const progress = state === 'past' || state === 'now' ? 100 : Math.round((elapsed / total) * 100);
  return { diff, state, progress };
}

function countdownText(diff) {
  if (diff > 0) {
    if (diff === 1) return 'يوم متبقٍ';
    if (diff === 2) return 'يومان متبقيان';
    if (diff <= 10) return 'أيام متبقية';
    return 'يوماً متبقياً';
  }
  if (diff === 0) return 'هو اليوم';
  return `مضى ${daysAr(-diff)}`;
}

/** نص المهمة للعرض خارج المحرر: بلا وسوم HTML ولا علامات ** القديمة */
function plainContent(content) {
  const text = (content ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
  if (text.startsWith('**') && text.endsWith('**') && text.length >= 5) {
    return text.slice(2, -2);
  }
  return text;
}

/** "أمس" / "قبل يومين" / "قبل 5 أيام" — عمر المهمة المتأخرة */
function overdueAgeLabel(dateKey, today) {
  const n = diffDaysBetweenKeys(dateKey, today);
  if (n === 1) return 'أمس';
  return `قبل ${daysAr(n)}`;
}

/** عنوان مجموعة يوم قادم: "غداً" أو "الأحد، 12 يوليو" */
function upcomingGroupLabel(dateKey, today) {
  const diff = diffDaysBetweenKeys(today, dateKey);
  if (diff === 1) return 'غداً';
  return formatFullDate(parseDateKey(dateKey));
}

function completionGroupLabel(dateKey, today) {
  const diff = diffDaysBetweenKeys(dateKey, today);
  if (diff === 0) return 'أُنجزت اليوم';
  if (diff === 1) return 'أُنجزت أمس';
  return `أُنجزت في ${formatFullDate(parseDateKey(dateKey))}`;
}

function taskCountLabel(count) {
  if (count === 0) return '0 مهام';
  if (count === 1) return 'مهمة واحدة';
  if (count === 2) return 'مهمتان';
  if (count <= 10) return `${count} مهام`;
  return `${count} مهمة`;
}

/**
 * توزيع ذكي لصفوف المعاينة على الأقسام الثلاثة:
 * القسم الفارغ ينكمش لشريط رفيع ولا يستهلك صفوفاً، ومساحته تذهب
 * للأقسام النشطة بالأولوية: اليوم ثم المتأخرة ثم القادمة.
 * الأعداد سخيّة كي تملأ شاشة آيفون 11 برو ماكس بلا فراغ:
 * ثلاثة أقسام نشطة → حتى ٤ لكلٍّ، قسمان → حتى ٥، قسم واحد → حتى ٧.
 */
function allocatePreviews(counts) {
  const order = ['today', 'late', 'next'];
  const activeCount = order.filter((k) => counts[k] > 0).length;
  const cap = activeCount <= 1 ? 7 : activeCount === 2 ? 5 : 4;
  let pool = activeCount <= 1 ? 7 : activeCount === 2 ? 10 : 12;
  const alloc = { today: 0, late: 0, next: 0 };
  for (const k of order) {
    alloc[k] = Math.min(2, counts[k], pool);
    pool -= alloc[k];
  }
  for (const k of order) {
    const extra = Math.min(cap - alloc[k], counts[k] - alloc[k], pool);
    if (extra > 0) {
      alloc[k] += extra;
      pool -= extra;
    }
  }
  return alloc;
}

/**
 * شاشة التقويم — مركز المهام في شاشة واحدة ثابتة بلا تمرير:
 * متأخرة (تُنقل لليوم بضغطة) / اليوم / قادمة، وشبكة الشهر
 * والعدادات التنازلية خلف ضغطة في أوراق منزلقة.
 */
export default function CalendarScreen({ onOpenSettings, onOpenDay }) {
  const live = useLiveData(exportAll, ALL_TABLES);
  const data = live.data;
  const today = todayKey();

  const [monthOpen, setMonthOpen] = useState(false);
  const [countdownModalOpen, setCountdownModalOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [taskSheet, setTaskSheet] = useState(null);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  /* ---------- تصنيف المهام: متأخرة / اليوم / قادمة ---------- */

  const {
    overdue,
    todayTasks,
    upcomingGroups,
    upcomingCount,
    completedTasks,
    tasksByDay,
    writingDays,
    openSubCount,
  } = useMemo(() => {
    const pageDate = new Map((data?.pages ?? []).map((p) => [p.id, p.page_date]));
    const byDay = new Map();
    const subCount = new Map();

    for (const b of data?.blocks ?? []) {
      if (b.kind !== 'task' || b.deleted_at) continue;
      if (b.parent_id) {
        if (!b.is_completed) subCount.set(b.parent_id, (subCount.get(b.parent_id) ?? 0) + 1);
        continue;
      }
      // تاريخ الاستحقاق مستقل عن يوم كتابة الملاحظة. المهام القديمة
      // التي لا تملك موعداً تستخدم تاريخ صفحتها تلقائياً.
      const d = b.due_date ?? pageDate.get(b.page_id);
      if (!d) continue;
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d).push(b);
    }
    for (const list of byDay.values()) {
      list.sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.position - b.position);
    }

    const overdueList = [];
    const todayList = [];
    const upcoming = [];
    const completed = [];
    for (const d of [...byDay.keys()].sort()) {
      for (const t of byDay.get(d)) {
        if (t.is_completed) {
          completed.push({ ...t, date: d });
          // منجزة اليوم تبقى ظاهرة في «مهام اليوم» بعلامتها — لا تختفي عند الإكمال
          if (d === today) todayList.push({ ...t, date: d });
          continue;
        }
        if (d < today) {
          overdueList.push({ ...t, date: d });
        } else if (d === today) {
          todayList.push({ ...t, date: d });
        } else {
          upcoming.push({ ...t, date: d });
        }
      }
    }
    todayList.sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.position - b.position);
    completed.sort((a, b) => {
      const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return bTime - aTime;
    });

    const groups = [];
    for (const t of upcoming) {
      if (groups.at(-1)?.date !== t.date) groups.push({ date: t.date, items: [] });
      groups.at(-1).items.push(t);
    }

    return {
      overdue: overdueList,
      todayTasks: todayList,
      upcomingGroups: groups,
      upcomingCount: upcoming.length,
      completedTasks: completed,
      tasksByDay: byDay,
      writingDays: new Set((data?.pages ?? []).map((p) => p.page_date)),
      openSubCount: subCount,
    };
  }, [data, today]);

  const upcomingTasks = upcomingGroups.flatMap((group) =>
    group.items.map((task) => ({ ...task, date: group.date }))
  );
  const todayDoneCount = todayTasks.filter((t) => t.is_completed).length;
  const completedGroups = useMemo(() => {
    const groups = [];
    for (const task of completedTasks) {
      const date = keyFromTimestamp(task.completed_at);
      let group = groups.at(-1);
      if (!group || group.date !== date) {
        group = { date, items: [] };
        groups.push(group);
      }
      group.items.push(task);
    }
    return groups;
  }, [completedTasks]);

  /* توزيع صفوف المعاينة حسب الأقسام غير الفارغة */
  const previewAlloc = useMemo(
    () =>
      allocatePreviews({
        late: overdue.length,
        today: todayTasks.length,
        next: upcomingCount,
      }),
    [overdue.length, todayTasks.length, upcomingCount]
  );
  const allTasksEmpty =
    overdue.length === 0 && todayTasks.length === 0 && upcomingCount === 0;
  // القسم الفارغ صف مضغوط (auto)، والنشط يأخذ حصة تتناسب مع صفوفه
  const snapshotRows = allTasksEmpty
    ? '1fr'
    : [overdue.length, todayTasks.length, upcomingCount]
        .map((count, i) => {
          if (count === 0) return 'auto';
          const shown = [previewAlloc.late, previewAlloc.today, previewAlloc.next][i];
          return `minmax(0, ${shown + 1}fr)`;
        })
        .join(' ');
  const sheetTasks =
    taskSheet?.type === 'overdue'
      ? overdue
      : taskSheet?.type === 'today'
        ? todayTasks
        : taskSheet?.type === 'upcoming'
          ? upcomingTasks
          : [];

  /* ---------- العدادات التنازلية ---------- */

  const countdowns = useMemo(() => {
    return [...(data?.countdowns ?? [])]
      .map((c) => ({ ...c, meta: countdownMeta(c, today) }))
      .sort((a, b) => {
        const aRank = a.meta.diff >= 0 ? 0 : 1;
        const bRank = b.meta.diff >= 0 ? 0 : 1;
        if (aRank !== bRank) return aRank - bRank;
        return Math.abs(a.meta.diff) - Math.abs(b.meta.diff);
      });
  }, [data?.countdowns, today]);

  const countdownsByDay = useMemo(() => {
    const byDay = new Map();
    for (const c of countdowns) {
      if (!byDay.has(c.target_date)) byDay.set(c.target_date, []);
      byDay.get(c.target_date).push(c);
    }
    return byDay;
  }, [countdowns]);


  /* ---------- الإجراءات ---------- */

  /** ينقل مهمة لحالة محددة — تحديث متفائل */
  const applyBlockStatus = (block, status) => {
    navigator.vibrate?.(10);
    const done = status === 'done';
    live.setData((d) => ({
      ...d,
      blocks: d.blocks.map((b) =>
        b.id === block.id
          ? { ...b, status, is_completed: done, completed_at: done ? new Date().toISOString() : null }
          : b
      ),
    }));
    setBlockStatus(block, status)
      .then(({ repeated }) => {
        if (!repeated) return;
        live.setData((d) => ({ ...d, blocks: [...d.blocks, repeated] }));
      })
      .catch(() => live.reload());
  };

  /** نقرة الدائرة: تدور بين حالات المهمة، كما في صفحة اليوم */
  const cycleBlockStatus = (block) => applyBlockStatus(block, nextTaskStatus(block.status));

  /** صفحة يوم محدد — الأولى إن تعددت، وتُنشأ إن لم توجد */
  const ensurePageFor = async (dateKey) => {
    const existing = (data?.pages ?? [])
      .filter((p) => p.page_date === dateKey)
      .sort((a, b) => (a.page_no ?? 1) - (b.page_no ?? 1))[0];
    if (existing) return existing;
    return createPage(dateKey, 1);
  };

  /** آخر موضع جذري في صفحة + 1 — للإلحاق في نهاية اليوم */
  const nextRootPosition = (pageId, blocks) => {
    const roots = blocks.filter((b) => b.page_id === pageId && !b.parent_id);
    return roots.length ? Math.max(...roots.map((b) => b.position || 0)) + 1 : 1;
  };

  /**
   * نقل مهمة متأخرة إلى صفحة اليوم (سلوك «أعد جدولتها لليوم»
   * في Todoist وAny.do): يتغير الموعد فقط، وتبقى المهمة في ملاحظتها
   * الأصلية كي لا تفقد سياقها.
   */
  const moveTaskToToday = async (task) => {
    navigator.vibrate?.(12);
    try {
      live.setData((d) => ({
        ...d,
        blocks: d.blocks.map((b) => {
          if (b.id === task.id) return { ...b, due_date: today };
          return b;
        }),
      }));
      await updateBlock(task.id, { due_date: today });
    } catch {
      live.reload();
    }
  };

  /** إضافة مهمة جديدة على يوم محدد (اليوم/غداً/أي تاريخ) */
  const addTask = async ({ dateKey, text, priority, repeatRule }) => {
    const page = await ensurePageFor(dateKey);
    const position = nextRootPosition(page.id, data?.blocks ?? []);
    await createBlock({
      page_id: page.id,
      kind: 'task',
      content: text,
      position,
      due_date: dateKey,
      priority,
      repeat_rule: repeatRule,
    });
    await live.reload();
  };

  const saveCountdown = async (fields) => {
    await createCountdown(fields);
    setCountdownModalOpen(false);
    await live.reload();
  };

  const removeCountdown = async (c) => {
    if (!window.confirm(`حذف عداد «${c.title}»؟`)) return;
    await deleteCountdown(c.id);
    await live.reload();
  };

  const openDayAt = (dateKey) => {
    setMonthOpen(false);
    setTaskSheet(null);
    setCompletedOpen(false);
    onOpenDay(dateKey);
  };

  const moveMonth = (delta) => {
    navigator.vibrate?.(5);
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  };

  const isCurrentMonth =
    viewDate.getFullYear() === new Date().getFullYear() &&
    viewDate.getMonth() === new Date().getMonth();

  const cells = useMemo(() => buildMonthGrid(viewDate), [viewDate]);

  /* ---------- العرض ---------- */

  return (
    <main className="screen calendar-screen">
      <header className="cal-head">
        <div>
          <h1>التقويم</h1>
          <p>اليوم وما حوله في نظرة واحدة</p>
        </div>
        <div className="calendar-header-actions">
          <button
            type="button"
            className="cal-completed-btn"
            aria-label="المهام المكتملة"
            onClick={() => setCompletedOpen(true)}
          >
            <CheckIcon size={15} />
            <span>{completedTasks.length}</span>
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="مهمة جديدة"
            onClick={() => setComposerOpen(true)}
          >
            <PlusIcon size={22} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="تقويم الشهر"
            onClick={() => setMonthOpen(true)}
          >
            <CalendarIcon size={22} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="الإعدادات"
            onClick={onOpenSettings}
          >
            <GearIcon size={24} />
          </button>
        </div>
      </header>

      {live.error && (
        <div className="error-banner">
          <span>تعذّر التحميل</span>
          <button type="button" onClick={live.reload}>أعد المحاولة</button>
        </div>
      )}

      <div className="calendar-dashboard">
        {data === null && !live.error && (
          <div className="inline-loading"><div className="spinner" /></div>
        )}

        {data !== null && (
          <>
            <div className="countdown-strip" aria-label="العدادات التنازلية">
              {countdowns.map((c) => (
                <CountdownChip key={c.id} countdown={c} onDelete={removeCountdown} />
              ))}
              <button
                type="button"
                className="countdown-chip countdown-chip-add"
                onClick={() => setCountdownModalOpen(true)}
                aria-label="إضافة عداد تنازلي"
              >
                <PlusIcon size={22} />
                <span>عدّاد جديد</span>
              </button>
            </div>

            <div
              className="task-snapshot"
              aria-label="ملخص المهام"
              style={{ gridTemplateRows: snapshotRows }}
            >
              {allTasksEmpty ? (
                <div className="task-snapshot-empty">
                  <CheckIcon size={30} />
                  <strong>لا مهام مفتوحة</strong>
                  <p>كل شيء منجز — أضف مهمة جديدة لبدء يومك.</p>
                  <button type="button" onClick={() => setComposerOpen(true)}>
                    مهمة جديدة
                  </button>
                </div>
              ) : (
                <>
              <TaskPreviewSection
                tone="late"
                title="متأخرة"
                count={overdue.length}
                tasks={overdue.slice(0, previewAlloc.late)}
                empty="لا شيء متأخر"
                onMore={() => setTaskSheet({ type: 'overdue', title: 'المهام المتأخرة' })}
              >
                {(task) => (
                  <TaskPreviewRow
                    key={task.id}
                    task={task}
                    meta={overdueAgeLabel(task.date, today)}
                    subCount={openSubCount.get(task.id) ?? 0}
                    onToggle={() => cycleBlockStatus(task)}
                    onOpen={() => openDayAt(task.date)}
                    action={
                      <button
                        type="button"
                        className="task-row-action"
                        onClick={() => moveTaskToToday(task)}
                      >
                        اليوم
                      </button>
                    }
                  />
                )}
              </TaskPreviewSection>

              <TaskPreviewSection
                tone="today"
                title="مهام اليوم"
                count={todayTasks.length}
                subtitle={
                  todayDoneCount > 0
                    ? `أنجزت ${todayDoneCount} من ${todayTasks.length}`
                    : undefined
                }
                tasks={todayTasks.slice(0, previewAlloc.today)}
                empty="لا مهام اليوم بعد"
                onMore={() => setTaskSheet({ type: 'today', title: 'مهام اليوم' })}
              >
                {(task) => (
                  <TaskPreviewRow
                    key={task.id}
                    task={task}
                    subCount={openSubCount.get(task.id) ?? 0}
                    onToggle={() => cycleBlockStatus(task)}
                    onOpen={() => openDayAt(today)}
                  />
                )}
              </TaskPreviewSection>

              <TaskPreviewSection
                tone="next"
                title="قادمة"
                count={upcomingCount}
                tasks={upcomingTasks.slice(0, previewAlloc.next)}
                empty="لا مهام قادمة"
                onMore={() => setTaskSheet({ type: 'upcoming', title: 'المهام القادمة' })}
              >
                {(task) => (
                  <TaskPreviewRow
                    key={task.id}
                    task={task}
                    meta={upcomingGroupLabel(task.date, today)}
                    subCount={openSubCount.get(task.id) ?? 0}
                    onToggle={() => cycleBlockStatus(task)}
                    onOpen={() => openDayAt(task.date)}
                  />
                )}
              </TaskPreviewSection>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <Modal
        open={Boolean(taskSheet)}
        onClose={() => setTaskSheet(null)}
        title={taskSheet?.title ?? 'المهام'}
        tall
      >
        {sheetTasks.length === 0 ? (
          <div className="empty-state">
            <CheckIcon size={38} />
            <p>لا توجد مهام هنا حالياً</p>
          </div>
        ) : (
          <div className="task-sheet-list">
            {sheetTasks.map((task) => (
              <TaskPreviewRow
                key={task.id}
                task={task}
                meta={
                  taskSheet?.type === 'overdue'
                    ? overdueAgeLabel(task.date, today)
                    : taskSheet?.type === 'upcoming'
                      ? upcomingGroupLabel(task.date, today)
                      : undefined
                }
                subCount={openSubCount.get(task.id) ?? 0}
                onToggle={() => cycleBlockStatus(task)}
                onOpen={() => openDayAt(task.date)}
                action={
                  taskSheet?.type === 'overdue' ? (
                    <button
                      type="button"
                      className="task-row-action"
                      onClick={() => moveTaskToToday(task)}
                    >
                      اليوم
                    </button>
                  ) : null
                }
              />
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={completedOpen}
        onClose={() => setCompletedOpen(false)}
        title="المهام المكتملة"
        tall
      >
        {completedTasks.length === 0 ? (
          <div className="empty-state">
            <CheckIcon size={38} />
            <p>لم تُكمل أي مهمة بعد</p>
          </div>
        ) : (
          <div className="task-history">
            {completedGroups.map((group) => (
              <section key={group.date} className="task-history-group">
                <header className="task-history-head">
                  <strong>{completionGroupLabel(group.date, today)}</strong>
                  <span>{taskCountLabel(group.items.length)}</span>
                </header>
                <div className="task-history-list">
                  {group.items.map((task) => (
                    <TaskHistoryRow
                      key={task.id}
                      task={task}
                      onToggle={() => applyBlockStatus(task, 'pending')}
                      onOpen={() => openDayAt(task.date)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </Modal>

      {/* ورقة تقويم الشهر — تظهر عند الطلب فقط */}
      <Modal open={monthOpen} onClose={() => setMonthOpen(false)} title="التقويم">
        <div className="calendar-nav">
          {/* في واجهة RTL: "السابق" يتجه يميناً و"التالي" يساراً */}
          <button
            type="button"
            className="icon-btn"
            aria-label="الشهر السابق"
            onClick={() => moveMonth(-1)}
          >
            <ChevronRightIcon size={20} />
          </button>
          <div className="calendar-title">
            <h2>{formatMonthYear(viewDate)}</h2>
            {!isCurrentMonth && (
              <button
                type="button"
                className="btn-text calendar-today-btn"
                onClick={() => {
                  const now = new Date();
                  setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
                }}
              >
                اليوم
              </button>
            )}
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="الشهر التالي"
            onClick={() => moveMonth(1)}
          >
            <ChevronLeftIcon size={20} />
          </button>
        </div>

        <div className="calendar-grid" role="grid">
          {WEEKDAYS.map((name, i) => (
            <span key={i} className="calendar-weekday">{name}</span>
          ))}
          {cells.map((cell, i) =>
            cell === null ? (
              <span key={`blank-${i}`} />
            ) : (
              <button
                key={cell.key}
                type="button"
                className={[
                  'calendar-day',
                  cell.key === today ? 'today' : '',
                  tasksByDay.has(cell.key) ? 'has-tasks' : '',
                  countdownsByDay.has(cell.key) ? 'has-countdown' : '',
                ].join(' ')}
                aria-label={relativeDayLabel(cell.key)}
                onClick={() => openDayAt(cell.key)}
              >
                <span className="calendar-day-num">{cell.day}</span>
                <span className="calendar-dots">
                  {countdownsByDay.has(cell.key) && (
                    <span className="calendar-dot countdown" />
                  )}
                  {(tasksByDay.get(cell.key) ?? []).slice(0, 3).map((t) => (
                    <span
                      key={t.id}
                      className={`calendar-dot${t.is_completed ? ' done' : ''}`}
                    />
                  ))}
                  {!tasksByDay.has(cell.key) && writingDays.has(cell.key) && (
                    <span className="calendar-dot writing" />
                  )}
                </span>
              </button>
            )
          )}
        </div>
        <p className="calendar-sheet-hint">اضغط على أي يوم لفتح صفحته</p>
      </Modal>

      <CountdownModal
        open={countdownModalOpen}
        onClose={() => setCountdownModalOpen(false)}
        onSave={saveCountdown}
      />

      <TaskComposer
        open={composerOpen}
        today={today}
        onClose={() => setComposerOpen(false)}
        onAdd={addTask}
      />
    </main>
  );
}

function TaskPreviewSection({ tone, title, count, subtitle, tasks, empty, onMore, onAdd, children }) {
  const hasMore = count > tasks.length;

  // قسم فارغ: شريط رفيع بدل بطاقة كاملة — المساحة تذهب للأقسام النشطة
  if (count === 0) {
    return (
      <section className={`task-preview task-preview-${tone} is-collapsed`}>
        <h2>{title}</h2>
        <span className="task-preview-clear">
          <CheckIcon size={13} />
          {empty}
        </span>
      </section>
    );
  }

  return (
    <section className={`task-preview task-preview-${tone}`}>
      <div className="task-preview-head">
        <div>
          <h2>{title}</h2>
          <span>{subtitle ?? taskCountLabel(count)}</span>
        </div>
        {hasMore && (
          <button type="button" className="task-preview-more" onClick={onMore}>
            عرض المزيد
          </button>
        )}
      </div>

      <div className="task-preview-list">
        {tasks.map((task) => children(task))}
        {/* إضافة سريعة تملأ المساحة المتبقية عندما تقلّ المهام المعروضة */}
        {onAdd && !hasMore && tasks.length < 4 && (
          <button type="button" className="task-preview-add" onClick={onAdd}>
            <PlusIcon size={15} />
            مهمة جديدة
          </button>
        )}
      </div>
    </section>
  );
}

function TaskPreviewRow({ task, subCount, meta, onToggle, onOpen, action }) {
  const status = task.status || 'pending';
  const showStatusLabel = status === 'in_progress' || status === 'postponed';
  return (
    <div className={`task-preview-row${task.is_completed ? ' done' : ''} status-${status}`}>
      <button
        type="button"
        className="task-preview-check"
        aria-label={`${TASK_STATUS_LABELS[status]} — اضغط للانتقال إلى ${TASK_STATUS_LABELS[nextTaskStatus(status)]}`}
        onClick={onToggle}
      >
        {status === 'done' && <CheckIcon size={12} />}
        {status === 'postponed' && <PostponedIcon size={11} />}
      </button>
      <button type="button" className="task-preview-text" onClick={onOpen}>
        <span className="task-preview-title">{plainContent(task.content) || 'مهمة بلا نص'}</span>
        {(meta || subCount > 0 || showStatusLabel || task.repeat_rule !== 'none' || task.priority > 1) && (
          <span className="task-preview-meta">
            {meta}
            {meta && subCount > 0 ? ' · ' : ''}
            {subCount > 0 ? `${subCount} فرعية` : ''}
            {(meta || subCount > 0) && showStatusLabel ? ' · ' : ''}
            {showStatusLabel ? TASK_STATUS_LABELS[status] : ''}
            {(meta || subCount > 0 || showStatusLabel) && (task.repeat_rule !== 'none' || task.priority > 1) ? ' · ' : ''}
            {task.repeat_rule !== 'none' ? 'متكررة' : ''}
            {task.repeat_rule !== 'none' && task.priority > 1 ? ' · ' : ''}
            {task.priority === 3 ? 'عاجلة' : task.priority === 2 ? 'مهمة' : ''}
          </span>
        )}
      </button>
      {action}
    </div>
  );
}

/** سجل المكتملات: تاريخ الإنجاز يقسم السجل، وتاريخ المهمة يظهر منفصلاً. */
function TaskHistoryRow({ task, onToggle, onOpen }) {
  return (
    <div className="task-history-row">
      <button
        type="button"
        className="task-history-check"
        aria-label="إلغاء الإكمال"
        onClick={onToggle}
      >
        <CheckIcon size={13} />
      </button>
      <button type="button" className="task-history-copy" onClick={onOpen}>
        <span className="task-history-title">{plainContent(task.content) || 'مهمة بلا نص'}</span>
        <span className="task-history-date">
          <small>يوم المهمة</small>
          {relativeDayLabel(task.date)}
        </span>
      </button>
    </div>
  );
}

/** نافذة إضافة مهمة بتاريخ: اليوم / غداً / تاريخ آخر */
function TaskComposer({ open, today, onClose, onAdd }) {
  const [text, setText] = useState('');
  const [choice, setChoice] = useState('today'); // today | tomorrow | custom
  const [customDate, setCustomDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [priority, setPriority] = useState(0);
  const [repeatRule, setRepeatRule] = useState('none');

  const tomorrow = useMemo(() => {
    const d = parseDateKey(today);
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [today]);

  const dateKey = choice === 'today' ? today : choice === 'tomorrow' ? tomorrow : customDate;
  const canSave = text.trim().length > 0 && Boolean(dateKey) && !busy;

  const reset = () => {
    setText('');
    setChoice('today');
    setCustomDate('');
    setPriority(0);
    setRepeatRule('none');
    setBusy(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    try {
      await onAdd({ dateKey, text: text.trim(), priority, repeatRule });
      reset();
      onClose();
    } catch {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="مهمة جديدة">
      <form onSubmit={submit}>
        <div className="field">
          <label className="field-label" htmlFor="task-text">المهمة</label>
          <input
            id="task-text"
            className="form-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="ماذا تريد أن تنجز؟"
            maxLength={500}
            autoFocus
          />
        </div>

        <div className="field">
          <span className="field-label">اليوم المستهدف</span>
          <div className="composer-days" role="radiogroup" aria-label="اليوم المستهدف">
            <button
              type="button"
              role="radio"
              aria-checked={choice === 'today'}
              className={`composer-day${choice === 'today' ? ' active' : ''}`}
              onClick={() => setChoice('today')}
            >
              اليوم
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={choice === 'tomorrow'}
              className={`composer-day${choice === 'tomorrow' ? ' active' : ''}`}
              onClick={() => setChoice('tomorrow')}
            >
              غداً
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={choice === 'custom'}
              className={`composer-day${choice === 'custom' ? ' active' : ''}`}
              onClick={() => setChoice('custom')}
            >
              <CalendarIcon size={16} />
              تاريخ آخر
            </button>
          </div>
          {choice === 'custom' && (
            <input
              type="date"
              className="form-input"
              aria-label="اختر التاريخ"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
            />
          )}
        </div>

        <div className="field">
          <span className="field-label">تنظيم المهمة</span>
          <div className="composer-task-options">
            <label>
              <span>الأولوية</span>
              <select value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
                <option value="0">عادية</option>
                <option value="1">منخفضة</option>
                <option value="2">مهمة</option>
                <option value="3">عاجلة</option>
              </select>
            </label>
            <label>
              <span>التكرار</span>
              <select value={repeatRule} onChange={(e) => setRepeatRule(e.target.value)}>
                <option value="none">مرة واحدة</option>
                <option value="daily">يومياً</option>
                <option value="weekly">أسبوعياً</option>
                <option value="monthly">شهرياً</option>
              </select>
            </label>
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={!canSave}>
          إضافة المهمة
        </button>
      </form>
    </Modal>
  );
}

/**
 * بطاقة عداد مضغوطة داخل الصف الأفقي — الرقم الكبير هو البطل.
 * كل العدّادات ظاهرة دفعةً واحدة بلا فتح ورقة. اضغط مطولاً للحذف.
 */
function CountdownChip({ countdown, onDelete }) {
  const timer = useRef(null);
  const { diff, state } = countdown.meta ?? countdownMeta(countdown, todayKey());
  const dateLabel = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', {
    day: 'numeric',
    month: 'short',
  }).format(parseDateKey(countdown.target_date));

  const cancel = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const start = () => {
    cancel();
    timer.current = setTimeout(() => {
      timer.current = null;
      onDelete(countdown);
    }, 550);
  };

  return (
    <div
      className={`countdown-chip ${state}`}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      title="اضغط مطولاً للحذف"
    >
      <span className="countdown-chip-main">
        <span className="countdown-chip-title">{countdown.title}</span>
        <span className="countdown-chip-date">{dateLabel}</span>
      </span>
      <span className="countdown-chip-days">
        <strong>{state === 'now' ? 'اليوم' : Math.abs(diff)}</strong>
        {state !== 'now' && (
          <small>{state === 'past' ? 'مضى' : countdownText(diff)}</small>
        )}
      </span>
    </div>
  );
}
