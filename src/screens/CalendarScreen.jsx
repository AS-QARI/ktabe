import { useMemo, useState } from 'react';
import {
  exportAll,
  setBlockCompleted,
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
import CountdownModal from '../components/countdowns/CountdownModal';
import {
  GearIcon,
  PlusIcon,
  TrashIcon,
  CheckIcon,
  NoteIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HourglassIcon,
} from '../components/ui/Icons';
import './screens.css';
import './CalendarScreen.css';

const ALL_TABLES = ['pages', 'blocks', 'countdowns'];
const WEEKDAYS = weekdayNames();

export default function CalendarScreen({ onOpenSettings, onOpenDay }) {
  const live = useLiveData(exportAll, ALL_TABLES);
  const data = live.data;

  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [countdownModalOpen, setCountdownModalOpen] = useState(false);

  const today = todayKey();
  const cells = useMemo(() => buildMonthGrid(viewDate), [viewDate]);

  /** المهام مفهرسة بتاريخ صفحتها — للنقاط تحت الأيام ولقائمة اليوم المحدد */
  const { tasksByDay, writingDays } = useMemo(() => {
    const pageDate = new Map((data?.pages ?? []).map((p) => [p.id, p.page_date]));
    const byDay = new Map();
    for (const b of data?.blocks ?? []) {
      if (b.kind !== 'task') continue;
      const d = pageDate.get(b.page_id);
      if (!d) continue;
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d).push(b);
    }
    for (const list of byDay.values()) {
      list.sort((a, b) => a.position - b.position);
    }
    return {
      tasksByDay: byDay,
      writingDays: new Set((data?.pages ?? []).map((p) => p.page_date)),
    };
  }, [data]);

  const selectedTasks = tasksByDay.get(selectedKey) ?? [];
  const isCurrentMonth =
    viewDate.getFullYear() === new Date().getFullYear() &&
    viewDate.getMonth() === new Date().getMonth();

  const moveMonth = (delta) => {
    navigator.vibrate?.(5);
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  };

  const goToday = () => {
    const now = new Date();
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedKey(today);
  };

  /** إكمال مهمة من قائمة اليوم — تحديث متفائل */
  const toggleBlock = (block) => {
    navigator.vibrate?.(10);
    const done = !block.is_completed;
    live.setData((d) => ({
      ...d,
      blocks: d.blocks.map((b) =>
        b.id === block.id
          ? { ...b, is_completed: done, completed_at: done ? new Date().toISOString() : null }
          : b
      ),
    }));
    setBlockCompleted(block.id, done).catch(() => live.reload());
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
                  {/* يوم فيه كتابة بلا مهام: نقطة رمادية واحدة */}
                  {!tasksByDay.has(cell.key) && writingDays.has(cell.key) && (
                    <span className="calendar-dot writing" />
                  )}
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
          className="btn-text open-day-btn"
          onClick={() => onOpenDay(selectedKey)}
        >
          <NoteIcon size={18} />
          فتح الصفحة
        </button>
      </div>

      {live.error && (
        <div className="error-banner">
          <span>تعذّر التحميل</span>
          <button type="button" onClick={live.reload}>أعد المحاولة</button>
        </div>
      )}

      {selectedTasks.length === 0 ? (
        <div className="empty-state compact">
          <p>
            {writingDays.has(selectedKey)
              ? 'لا مهام في صفحة هذا اليوم — افتحها لإضافة سطر مهمة'
              : 'لا صفحة لهذا اليوم بعد — افتحها وابدأ الكتابة'}
          </p>
        </div>
      ) : (
        <div className="card-list">
          {selectedTasks.map((t) => (
            <div key={t.id} className={`cal-task-row${t.is_completed ? ' done' : ''}`}>
              <button
                type="button"
                className="cal-task-circle"
                role="checkbox"
                aria-checked={t.is_completed}
                aria-label={t.is_completed ? 'إلغاء الإكمال' : 'إكمال المهمة'}
                onClick={() => toggleBlock(t)}
              >
                <CheckIcon size={12} />
              </button>
              <button
                type="button"
                className="cal-task-text"
                onClick={() => onOpenDay(selectedKey)}
              >
                {t.content || 'مهمة بلا نص'}
              </button>
            </div>
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

      {data?.countdowns?.length === 0 ? (
        <div className="empty-state">
          <HourglassIcon size={40} />
          <p>أضف مناسباتك المهمة وتابع كم يوماً يفصلك عنها</p>
        </div>
      ) : (
        <div className="countdown-grid">
          {data?.countdowns?.map((c) => (
            <CountdownCard key={c.id} countdown={c} onDelete={removeCountdown} />
          ))}
        </div>
      )}

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
            <span className="countdown-label">
              {diff === 1
                ? 'يوم متبقٍ'
                : diff === 2
                  ? 'يومان متبقيان'
                  : diff <= 10
                    ? 'أيام متبقية'
                    : 'يوماً متبقياً'}
            </span>
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
