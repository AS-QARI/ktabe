import { useEffect, useMemo, useState } from 'react';
import { exportAll } from '../data/storage';
import { useLiveData } from '../hooks/useLiveData';
import {
  computeTodayProgress,
  computeOverallStats,
  computeWeeklyStats,
} from '../utils/stats';
import { parseDateKey, formatWeekday } from '../utils/dates';
import { tasksAr } from '../utils/format';
import {
  GearIcon,
  CheckIcon,
  FlameIcon,
  CalendarIcon,
  ChartIcon,
} from '../components/ui/Icons';
import './screens.css';
import './SummaryScreen.css';

const ALL_TABLES = ['pages', 'blocks', 'countdowns'];
const weekdayNarrowFmt = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', {
  weekday: 'narrow',
});

export default function SummaryScreen({ onOpenSettings }) {
  // نفس مُصدِّر النسخة الاحتياطية يخدم الملخص — مصدر حقيقة واحد
  const live = useLiveData(exportAll, ALL_TABLES);
  const data = live.data;

  const today = useMemo(
    () => (data ? computeTodayProgress(data) : null),
    [data]
  );
  const overall = useMemo(
    () => (data ? computeOverallStats(data) : null),
    [data]
  );
  const week = useMemo(
    () => (data ? computeWeeklyStats(data) : null),
    [data]
  );
  const todayState = useMemo(() => (today ? buildTodayState(today) : null), [today]);

  return (
    <main className="screen summary-screen">
      <header className="screen-header">
        <h1>الملخص</h1>
        <button
          type="button"
          className="icon-btn"
          aria-label="الإعدادات"
          onClick={onOpenSettings}
        >
          <GearIcon size={24} />
        </button>
      </header>

      {live.error && (
        <div className="error-banner">
          <span>تعذّر تحميل الملخص</span>
          <button type="button" onClick={live.reload}>أعد المحاولة</button>
        </div>
      )}

      {!data && !live.error ? (
        <div className="inline-loading"><div className="spinner" /></div>
      ) : data ? (
        <>
          <section className="summary-hero" aria-label="حالة اليوم">
            <div className="summary-hero-main">
              <ProgressRing percent={today.percent} empty={today.total === 0} />
              <div className="today-copy">
                <span className="summary-eyebrow">اليوم</span>
                <h2>{todayState.title}</h2>
                <p>{todayState.subtitle}</p>
              </div>
            </div>

            <div className="today-pills" aria-label="تفاصيل اليوم">
              <MetricPill label="أنجزت" value={today.done} tone="success" />
              <MetricPill
                label="متبقي"
                value={today.remaining}
                tone={today.remaining === 0 ? 'success' : 'neutral'}
              />
              <MetricPill label="المجموع" value={today.total} />
            </div>
          </section>

          <section className="summary-board" aria-label="نظرة سريعة">
            <div className="summary-board-head">
              <h2>نظرة سريعة</h2>
              <span className="summary-chip">{buildWeekBadge(week)}</span>
            </div>

            <WeekStrip days={week.days} />

            <div className="compact-stats-grid">
              <CompactStat
                icon={<CheckIcon size={18} />}
                value={week.completedTotal}
                label="هذا الأسبوع"
              />
              <CompactStat
                icon={<CalendarIcon size={18} />}
                value={week.activeDays}
                label="أيام نشطة"
              />
              <CompactStat
                icon={<FlameIcon size={18} />}
                value={overall.currentStreak}
                label="السلسلة الحالية"
              />
              <CompactStat
                icon={<ChartIcon size={18} />}
                value={week.bestDay?.count ?? 0}
                label={
                  week.bestDay
                    ? `أفضل يوم ${formatWeekday(parseDateKey(week.bestDay.key))}`
                    : 'أفضل يوم'
                }
              />
              <CompactStat
                icon={<CheckIcon size={18} />}
                value={overall.totalCompleted}
                label="الإجمالي المنجز"
              />
              <CompactStat
                icon={<FlameIcon size={18} />}
                value={overall.longestStreak}
                label="أطول سلسلة"
              />
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

function buildTodayState(today) {
  if (today.total === 0) {
    return {
      title: 'مساحة هادئة لليوم',
      subtitle: 'لا توجد مهام بعد. اكتب أول مهمة صغيرة ليبدأ اليوم بشكل واضح.',
    };
  }

  if (today.done === today.total) {
    return {
      title: 'اليوم مقفول براحة',
      subtitle: 'أنهيت كل مهام اليوم. هذا بالضبط الإحساس الذي نريده آخر اليوم.',
    };
  }

  if (today.done === 0) {
    return {
      title: 'ابدأ بأول خطوة',
      subtitle: `أمامك ${tasksAr(today.remaining)}. أول إنجاز الآن سيجعل الباقي أخف.`,
    };
  }

  if (today.percent >= 70) {
    return {
      title: 'بقي القليل',
      subtitle: `تبقّى ${tasksAr(today.remaining)} فقط، وأنت قريب من إنهاء يومك بالكامل.`,
    };
  }

  if (today.percent >= 40) {
    return {
      title: 'أنت في المسار',
      subtitle: `أنجزت ${today.done} حتى الآن، وبقي ${today.remaining} للوصول لختام مريح.`,
    };
  }

  return {
    title: 'اليوم يحتاج دفعة بسيطة',
    subtitle: `أنجزت ${today.done} حتى الآن. كمّل بمهمة واحدة لتسريع الوتيرة.`,
  };
}

function buildWeekBadge(week) {
  if (week.completedTotal === 0) {
    return 'أسبوع هادئ';
  }

  if (week.activeDays === 1) {
    return `${tasksAr(week.completedTotal)} في يوم واحد`;
  }

  return `${tasksAr(week.completedTotal)} في ${week.activeDays} أيام`;
}

/**
 * حلقة التقدم اليومية — عدّاد (Meter):
 * التعبئة بلون التمييز، والمسار غير الممتلئ درجة أفتح من نفس اللون
 * (وليس رمادياً محايداً) حتى تُقرأ الحالة على امتداد الحلقة كلها.
 * الرقم في المنتصف بحبر النص — اللون للحلقة، والقيمة للنص.
 */
function ProgressRing({ percent, empty }) {
  const R = 54;
  const C = 2 * Math.PI * R;
  // نبدأ من صفر ثم ننتقل للقيمة كي تتحرك الحلقة عند الدخول
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setShown(percent))
    );
    return () => cancelAnimationFrame(raf);
  }, [percent]);

  return (
    <div className="ring-wrap" role="img" aria-label={`نسبة إنجاز اليوم ${percent}٪`}>
      <svg width="132" height="132" viewBox="0 0 132 132">
        <circle className="ring-track" cx="66" cy="66" r={R} strokeWidth="11" />
        <circle
          className="ring-fill"
          cx="66"
          cy="66"
          r={R}
          strokeWidth="11"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - shown / 100)}
          transform="rotate(-90 66 66)"
        />
      </svg>
      <span className="ring-value">{empty ? '—' : `${percent}٪`}</span>
    </div>
  );
}

function MetricPill({ label, value, tone = 'neutral' }) {
  return (
    <div className={`metric-pill metric-pill-${tone}`}>
      <span className="metric-pill-value">{value}</span>
      <span className="metric-pill-label">{label}</span>
    </div>
  );
}

function WeekStrip({ days }) {
  const max = Math.max(...days.map((day) => day.count), 1);

  return (
    <div className="week-strip" role="img" aria-label="رسم يوضح عدد المهام المنجزة خلال آخر سبعة أيام">
      {days.map((day, index) => {
        const height = day.count === 0 ? 18 : 22 + Math.round((day.count / max) * 60);
        const isToday = index === days.length - 1;

        return (
          <div key={day.key} className="week-strip-day">
            <div className="week-strip-track">
              <div
                className={`week-strip-bar${isToday ? ' is-today' : ''}`}
                style={{ height: `${height}%` }}
              />
            </div>
            <span className="week-strip-label">
              {weekdayNarrowFmt.format(parseDateKey(day.key))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CompactStat({ icon, value, label }) {
  return (
    <div className="compact-stat">
      <span className="compact-stat-icon">{icon}</span>
      <span className="compact-stat-value">{value}</span>
      <span className="compact-stat-label">{label}</span>
    </div>
  );
}
