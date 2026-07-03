import { useMemo, useState } from 'react';
import {
  listTasks,
  updateTask,
  createTask,
  setTaskCompleted,
  deleteTask,
  listCountdowns,
  createCountdown,
  deleteCountdown,
} from '../data/storage';
import { useLiveData } from '../hooks/useLiveData';
import {
  buildMonthGrid,
  weekdayNames,
  formatMonthYear,
  todayKey,
  relativeDayLabel,
  diffDaysBetweenKeys,
  parseDateKey,
} from '../utils/dates';
import { daysAr } from '../utils/format';
import TaskItem from '../components/tasks/TaskItem';
import TaskModal from '../components/tasks/TaskModal';
import CountdownModal from '../components/countdowns/CountdownModal';
import {
  GearIcon,
  PlusIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HourglassIcon,
} from '../components/ui/Icons';
import './screens.css';
import './CalendarScreen.css';

const TASK_TABLES = ['tasks'];
const COUNTDOWN_TABLES = ['countdowns'];
const WEEKDAYS = weekdayNames();

export default function CalendarScreen({ onOpenSettings }) {
  const tasksLive = useLiveData(listTasks, TASK_TABLES);
  const countdownsLive = useLiveData(listCountdowns, COUNTDOWN_TABLES);

  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [taskModal, setTaskModal] = useState({ open: false, task: null });
  const [countdownModalOpen, setCountdownModalOpen] = useState(false);

  const today = todayKey();
  const cells = useMemo(() => buildMonthGrid(viewDate), [viewDate]);

  /** المهام مفهرسة بيوم الاستحقاق — للنقاط تحت الأيام ولقائمة اليوم المحدد */
  const tasksByDay = useMemo(() => {
    const map = new Map();
    for (const t of tasksLive.data ?? []) {
      if (!t.due_date) continue;
      if (!map.has(t.due_date)) map.set(t.due_date, []);
      map.get(t.due_date).push(t);
    }
    return map;
  }, [tasksLive.data]);

  const selectedTasks = tasksByDay.get(selectedKey) ?? [];
  const isCurrentMonth =
    viewDate.getFullYear() === new Date().getFullYear() &&
    viewDate.getMonth() === new Date().getMonth();

  const moveMonth = (delta) => {
    navigator.vibrate?.(5);
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  };

  const goToday = () => {
    setViewDate(() => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    setSelectedKey(today);
  };

  /* ---------- عمليات المهام (نفس منطق الشاشة الرئيسية) ---------- */

  const toggleTask = async (task) => {
    const done = !task.is_completed;
    tasksLive.setData((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, is_completed: done, completed_at: done ? new Date().toISOString() : null }
          : t
      )
    );
    try {
      await setTaskCompleted(task.id, done);
    } catch {
      tasksLive.reload();
    }
  };

  const saveTask = async (fields) => {
    if (taskModal.task) {
      await updateTask(taskModal.task.id, fields);
    } else {
      await createTask(fields);
    }
    setTaskModal({ open: false, task: taskModal.task });
    await tasksLive.reload();
  };

  const removeTask = async (task) => {
    await deleteTask(task.id);
    setTaskModal({ open: false, task: null });
    await tasksLive.reload();
  };

  /* ---------- عمليات العدادات ---------- */

  const saveCountdown = async (fields) => {
    await createCountdown(fields);
    setCountdownModalOpen(false);
    await countdownsLive.reload();
  };

  const removeCountdown = async (c) => {
    if (!window.confirm(`حذف عداد «${c.title}»؟`)) return;
    await deleteCountdown(c.id);
    await countdownsLive.reload();
  };

  return (
    <main className="screen">
      <header className="screen-header">
        <h1>التقويم</h1>
        <button
          type="button"
          className="icon-btn"
          aria-label="الإعدادات"
          onClick={onOpenSettings}
        >
          <GearIcon size={24} />
        </button>
      </header>

      {/* ---------- شبكة الشهر ---------- */}

      <div className="calendar-card">
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
              <button type="button" className="btn-text calendar-today-btn" onClick={goToday}>
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
                  cell.key === selectedKey ? 'selected' : '',
                ].join(' ')}
                aria-label={relativeDayLabel(cell.key)}
                onClick={() => setSelectedKey(cell.key)}
              >
                <span className="calendar-day-num">{cell.day}</span>
                <span className="calendar-dots">
                  {(tasksByDay.get(cell.key) ?? []).slice(0, 3).map((t) => (
                    <span
                      key={t.id}
                      className={`calendar-dot${t.is_completed ? ' done' : ''}`}
                    />
                  ))}
                </span>
              </button>
            )
          )}
        </div>
      </div>

      {/* ---------- مهام اليوم المحدد ---------- */}

      <div className="section-header">
        <h2>مهام {relativeDayLabel(selectedKey)}</h2>
        <button
          type="button"
          className="icon-btn"
          aria-label="إضافة مهمة لهذا اليوم"
          onClick={() =>
            setTaskModal({ open: true, task: null, presetDue: selectedKey })
          }
        >
          <PlusIcon size={22} />
        </button>
      </div>

      {selectedTasks.length === 0 ? (
        <div className="empty-state compact">
          <p>لا مهام مستحقة في هذا اليوم</p>
        </div>
      ) : (
        <div className="card-list">
          {selectedTasks.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              onToggle={toggleTask}
              onOpen={(task) => setTaskModal({ open: true, task })}
            />
          ))}
        </div>
      )}

      {/* ---------- العدادات التنازلية ---------- */}

      <div className="section-header">
        <h2>العدادات التنازلية</h2>
        <button
          type="button"
          className="icon-btn"
          aria-label="عداد جديد"
          onClick={() => setCountdownModalOpen(true)}
        >
          <PlusIcon size={22} />
        </button>
      </div>

      {countdownsLive.error && (
        <div className="error-banner">
          <span>تعذّر تحميل العدادات</span>
          <button type="button" onClick={countdownsLive.reload}>أعد المحاولة</button>
        </div>
      )}

      {countdownsLive.data?.length === 0 ? (
        <div className="empty-state">
          <HourglassIcon size={40} />
          <p>أضف مناسباتك المهمة وتابع كم يوماً يفصلك عنها</p>
        </div>
      ) : (
        <div className="countdown-grid">
          {countdownsLive.data?.map((c) => (
            <CountdownCard key={c.id} countdown={c} onDelete={removeCountdown} />
          ))}
        </div>
      )}

      <TaskModal
        open={taskModal.open}
        task={taskModal.task}
        preset={taskModal.presetDue ? { due_date: taskModal.presetDue } : null}
        onClose={() => setTaskModal((m) => ({ ...m, open: false }))}
        onSave={saveTask}
        onDelete={removeTask}
      />

      <CountdownModal
        open={countdownModalOpen}
        onClose={() => setCountdownModalOpen(false)}
        onSave={saveCountdown}
      />
    </main>
  );
}

/** بطاقة عداد: الرقم الكبير هو البطل — كم يوماً بقي */
function CountdownCard({ countdown, onDelete }) {
  const diff = diffDaysBetweenKeys(todayKey(), countdown.target_date);
  const state = diff > 0 ? 'future' : diff === 0 ? 'now' : 'past';
  const dateLabel = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseDateKey(countdown.target_date));

  return (
    <div className={`countdown-card ${state}`}>
      <div className="countdown-top">
        <span className="countdown-title">{countdown.title}</span>
        <button
          type="button"
          className="icon-btn countdown-delete"
          aria-label={`حذف ${countdown.title}`}
          onClick={() => onDelete(countdown)}
        >
          <TrashIcon size={18} />
        </button>
      </div>
      <div className="countdown-value">
        {state === 'future' && (
          <>
            <span className="countdown-num">{diff}</span>
            <span className="countdown-label">{diff === 1 ? 'يوم متبقٍ' : diff === 2 ? 'يومان متبقيان' : diff <= 10 ? 'أيام متبقية' : 'يوماً متبقياً'}</span>
          </>
        )}
        {state === 'now' && <span className="countdown-now">هو اليوم! 🎉</span>}
        {state === 'past' && (
          <span className="countdown-past">مضى {daysAr(-diff)}</span>
        )}
      </div>
      <div className="countdown-date">{dateLabel}</div>
    </div>
  );
}
