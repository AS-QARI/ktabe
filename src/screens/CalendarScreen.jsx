import { useMemo, useState } from 'react';
import {
  exportAll,
  setBlockCompleted,
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
  const selectedDone = selectedTasks.filter((t) => t.is_completed).length;
  const selectedProgress =
    selectedTasks.length === 0 ? 0 : Math.round((selectedDone / selectedTasks.length) * 100);

  const countdowns = useMemo(() => {
    const todayValue = todayKey();
    return [...(data?.countdowns ?? [])]
      .map((countdown) => ({ ...countdown, meta: countdownMeta(countdown, todayValue) }))
      .sort((a, b) => {
        const aRank = a.meta.diff >= 0 ? 0 : 1;
        const bRank = b.meta.diff >= 0 ? 0 : 1;
        if (aRank !== bRank) return aRank - bRank;
        return Math.abs(a.meta.diff) - Math.abs(b.meta.diff);
      });
  }, [data?.countdowns]);

  const countdownsByDay = useMemo(() => {
    const byDay = new Map();
    for (const c of countdowns) {
      if (!byDay.has(c.target_date)) byDay.set(c.target_date, []);
      byDay.get(c.target_date).push(c);
    }
    return byDay;
  }, [countdowns]);

  const spotlightCountdown = countdowns[0] ?? null;
  const futureCountdowns = countdowns.filter((c) => c.meta.diff >= 0).length;
  const todayTasks = tasksByDay.get(today)?.length ?? 0;
  const selectedCountdowns = countdownsByDay.get(selectedKey) ?? [];
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
    <main className="screen calendar-screen">
      <header className="screen-header">
        <div>
          <h1>التقويم</h1>
          <p className="screen-subtitle">نظرة شهرية، مهام اليوم، وعدّاداتك المهمة.</p>
        </div>
        <div className="calendar-header-actions">
          <button
            type="button"
            className="icon-btn filled"
            aria-label="عداد جديد"
            onClick={() => setCountdownModalOpen(true)}
          >
            <PlusIcon size={22} />
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

      <CountdownSpotlight
        countdown={spotlightCountdown}
        onCreate={() => setCountdownModalOpen(true)}
      />

      <div className="calendar-insights" aria-label="ملخص سريع">
        <InsightPill label="مهام اليوم" value={todayTasks} />
        <InsightPill label="اليوم المحدد" value={`${selectedDone}/${selectedTasks.length}`} />
        <InsightPill label="عدادات قادمة" value={futureCountdowns} />
      </div>

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
	                  tasksByDay.has(cell.key) ? 'has-tasks' : '',
	                  countdownsByDay.has(cell.key) ? 'has-countdown' : '',
	                ].join(' ')}
                aria-label={relativeDayLabel(cell.key)}
                onClick={() => setSelectedKey(cell.key)}
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

      {live.error && (
        <div className="error-banner">
          <span>تعذّر التحميل</span>
          <button type="button" onClick={live.reload}>أعد المحاولة</button>
        </div>
      )}

      <div className="section-header calendar-section-title">
        <div>
          <h2>{relativeDayLabel(selectedKey)}</h2>
          <p>{formatSelectedDate(selectedKey)}</p>
        </div>
        <button
          type="button"
          className="btn-text open-day-btn"
          onClick={() => onOpenDay(selectedKey)}
        >
          <NoteIcon size={18} />
          فتح الصفحة
        </button>
      </div>

      <SelectedDayCard
        tasks={selectedTasks}
        countdowns={selectedCountdowns}
        writingDays={writingDays}
        selectedKey={selectedKey}
        selectedDone={selectedDone}
        selectedProgress={selectedProgress}
        onOpenDay={onOpenDay}
        onToggleTask={toggleBlock}
      />

      <div className="section-header calendar-section-title">
        <div>
          <h2>العدادات التنازلية</h2>
          <p>مرتبة حسب الأقرب، مثل لوحة انتظار صغيرة.</p>
        </div>
      </div>

      {data?.countdowns?.length === 0 ? (
        <div className="empty-state calendar-empty-countdowns">
          <HourglassIcon size={40} />
          <p>أضف مناسباتك المهمة وتابع كم يوماً يفصلك عنها</p>
        </div>
      ) : (
        <div className="countdown-grid">
          {countdowns.map((c) => (
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

function formatSelectedDate(key) {
  return new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseDateKey(key));
}

function InsightPill({ label, value }) {
  return (
    <div className="calendar-insight-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CountdownSpotlight({ countdown, onCreate }) {
  if (!countdown) {
    return (
      <section className="countdown-spotlight empty">
        <div>
          <span className="spotlight-kicker">واجهة العد التنازلي</span>
          <h2>اختر تاريخاً مهمّاً ودع الصفحة تذكّرك كم باقي.</h2>
          <p>مناسبات، اختبارات، سفر، أو أي هدف يحتاج عينك عليه كل يوم.</p>
        </div>
        <button type="button" className="spotlight-action" onClick={onCreate}>
          <PlusIcon size={18} />
          عداد جديد
        </button>
      </section>
    );
  }

  const { diff, state, progress } = countdown.meta;
  const dateLabel = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseDateKey(countdown.target_date));

  return (
    <section className={`countdown-spotlight ${state}`}>
      <div className="spotlight-orbit" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="spotlight-content">
        <span className="spotlight-kicker">أقرب عدّاد</span>
        <h2>{countdown.title}</h2>
        <p>{dateLabel}</p>
      </div>
      <div className="spotlight-number" aria-label={countdownText(diff)}>
        {diff > 0 ? (
          <>
            <strong>{diff}</strong>
            <span>{countdownText(diff)}</span>
          </>
        ) : diff < 0 ? (
          <>
            <strong>{Math.abs(diff)}</strong>
            <span>أيام مضت</span>
          </>
        ) : (
          <strong className="spotlight-state-text">اليوم</strong>
        )}
      </div>
      <div className="spotlight-progress" aria-hidden="true">
        <span style={{ inlineSize: `${progress}%` }} />
      </div>
    </section>
  );
}

function SelectedDayCard({
  tasks,
  countdowns,
  writingDays,
  selectedKey,
  selectedDone,
  selectedProgress,
  onOpenDay,
  onToggleTask,
}) {
  const hasWriting = writingDays.has(selectedKey);
  const previewTasks = tasks.slice(0, 3);

  return (
    <section className="selected-day-card">
      <div className="selected-day-summary">
        <div className="selected-ring" style={{ '--progress': `${selectedProgress}%` }}>
          <span>{selectedProgress}%</span>
        </div>
        <div>
          <h3>
            {tasks.length > 0
              ? `${selectedDone} من ${tasks.length} منجزة`
              : hasWriting
                ? 'فيه كتابة بدون مهام'
                : 'يوم جديد وفاضي'}
          </h3>
          <p>
            {tasks.length > 0
              ? 'اضغط على أي مهمة لإكمالها سريعاً أو افتح الصفحة للتفاصيل.'
              : hasWriting
                ? 'افتح الصفحة وحوّل الأسطر المهمة إلى مهام عند الحاجة.'
                : 'افتح الصفحة وابدأ تخطيط اليوم من الدفتر.'}
          </p>
        </div>
      </div>

      {countdowns.length > 0 && (
        <div className="selected-countdowns">
          {countdowns.map((c) => (
            <span key={c.id}>
              <HourglassIcon size={14} />
              {c.title}
            </span>
          ))}
        </div>
      )}

      {previewTasks.length > 0 ? (
        <div className="selected-task-preview">
          {previewTasks.map((t) => (
            <div key={t.id} className={`cal-task-row${t.is_completed ? ' done' : ''}`}>
              <button
                type="button"
                className="cal-task-circle"
                role="checkbox"
                aria-checked={t.is_completed}
                aria-label={t.is_completed ? 'إلغاء الإكمال' : 'إكمال المهمة'}
                onClick={() => onToggleTask(t)}
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
          {tasks.length > previewTasks.length && (
            <button
              type="button"
              className="selected-more"
              onClick={() => onOpenDay(selectedKey)}
            >
              عرض {tasks.length - previewTasks.length} مهام إضافية
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="selected-empty-action"
          onClick={() => onOpenDay(selectedKey)}
        >
          <NoteIcon size={18} />
          افتح صفحة هذا اليوم
        </button>
      )}
    </section>
  );
}

/** بطاقة عداد: الرقم الكبير هو البطل — كم يوماً بقي */
function CountdownCard({ countdown, onDelete }) {
  const { diff, state, progress } = countdown.meta ?? countdownMeta(countdown, todayKey());
  const dateLabel = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseDateKey(countdown.target_date));

  return (
    <div className={`countdown-card ${state}`}>
      <div className="countdown-top">
        <span className="countdown-title">
          <HourglassIcon size={16} />
          {countdown.title}
        </span>
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
            <span className="countdown-label">{countdownText(diff)}</span>
          </>
        )}
        {state === 'now' && <span className="countdown-now">هو اليوم!</span>}
        {state === 'past' && (
          <span className="countdown-past">مضى {daysAr(-diff)}</span>
        )}
      </div>
      <div className="countdown-progress" aria-hidden="true">
        <span style={{ inlineSize: `${progress}%` }} />
      </div>
      <div className="countdown-date">{dateLabel}</div>
    </div>
  );
}
