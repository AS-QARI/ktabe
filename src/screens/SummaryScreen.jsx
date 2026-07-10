import { useEffect, useMemo, useState } from 'react';
import { exportAll } from '../data/storage';
import { useLiveData } from '../hooks/useLiveData';
import {
  computeTodayProgress,
  computeOverallStats,
  computeWeeklyStats,
} from '../utils/stats';
import { parseDateKey, formatWeekday, formatFullDate } from '../utils/dates';
import { tasksAr, daysAr } from '../utils/format';
import { GearIcon, CheckIcon, FlameIcon } from '../components/ui/Icons';
import './screens.css';
import './SummaryScreen.css';

const ALL_TABLES = ['pages', 'blocks', 'countdowns'];
const weekdayNarrowFmt = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', {
  weekday: 'narrow',
});

/**
 * لوحة ملخص بشاشة واحدة ثابتة (بلا تمرير) — ثلاث مناطق بأسلوب
 * لوحات الإنتاجية في Todoist/TickTick وتطبيقات العادات:
 *   ١) بطل اليوم: حلقة التقدم + عدّاد المهام
 *   ٢) صف مؤشرات: السلسلة + الإجمالي
 *   ٣) آخر ٧ أيام: أعمدة + أيام نشطة + أفضل يوم
 */
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
      <header className="summary-head">
        <div className="summary-head-copy">
          <h1>الملخص</h1>
          <p className="summary-date">{formatFullDate(new Date())}</p>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="الإعدادات"
          onClick={onOpenSettings}
        >
          <GearIcon size={24} />
        </button>
        {live.error && (
          <div className="error-banner summary-error">
            <span>تعذّر تحميل الملخص</span>
            <button type="button" onClick={live.reload}>أعد المحاولة</button>
          </div>
        )}
      </header>

      {!data ? (
        !live.error && (
          <div className="sum-body is-loading">
            <div className="spinner" />
          </div>
        )
      ) : (
        <div className="sum-body">
          <section className="sum-card sum-hero" aria-label="تقدم اليوم">
            <div className="sum-hero-top">
              <ProgressRing percent={today.percent} empty={today.total === 0} />
              <div className="sum-hero-copy">
                <span className="sum-eyebrow">اليوم</span>
                <h2>{todayState.title}</h2>
                <p>{todayState.subtitle}</p>
              </div>
            </div>
            <TodayMeter today={today} />
          </section>

          <section className="sum-tiles" aria-label="مؤشرات عامة">
            <StatTile
              icon={<FlameIcon size={16} />}
              warm={overall.currentStreak > 0}
              value={overall.currentStreak}
              unit={dayUnit(overall.currentStreak)}
              label="السلسلة الحالية"
              sub={
                overall.longestStreak > 0
                  ? `الأطول: ${daysAr(overall.longestStreak)}`
                  : 'أنجز مهمة لبدء السلسلة'
              }
            />
            <StatTile
              icon={<CheckIcon size={16} />}
              value={overall.totalCompleted}
              unit="مهمة"
              label="إجمالي المنجز"
              sub={`أيام الاستخدام: ${overall.usageDays}`}
            />
          </section>

          <section className="sum-card sum-week" aria-label="إنجاز آخر سبعة أيام">
            <header className="sum-week-head">
              <h2>آخر ٧ أيام</h2>
              <span className="sum-week-total">
                <b>{week.completedTotal}</b> منجزة
              </span>
            </header>
            <WeekChart days={week.days} />
            <footer className="sum-week-foot">
              <span>
                أيام نشطة <b>{week.activeDays}</b> من 7
              </span>
              {week.bestDay ? (
                <span>
                  الأفضل: {formatWeekday(parseDateKey(week.bestDay.key))}{' '}
                  <b>{week.bestDay.count}</b>
                </span>
              ) : (
                <span>سجّل أول إنجاز هذا الأسبوع</span>
              )}
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}

/** وحدة "يوم" المرافقة للرقم الكبير (الرقم يُعرض منفصلاً) */
function dayUnit(n) {
  if (n === 1) return 'يوم';
  if (n === 2) return 'يومان';
  if (n >= 3 && n <= 10) return 'أيام';
  return n === 0 ? 'أيام' : 'يوماً';
}

function buildTodayState(today) {
  if (today.total === 0) {
    return {
      title: 'مساحة هادئة لليوم',
      subtitle: 'اكتب أول مهمة صغيرة ليبدأ يومك بشكل واضح.',
    };
  }

  if (today.done === today.total) {
    return {
      title: 'اليوم مقفول براحة',
      subtitle: 'أنهيت كل مهام اليوم — ختام ممتاز.',
    };
  }

  if (today.done === 0) {
    return {
      title: 'ابدأ بأول خطوة',
      subtitle: `أمامك ${tasksAr(today.remaining)}، وأول إنجاز يجعل الباقي أخف.`,
    };
  }

  if (today.percent >= 70) {
    return {
      title: 'بقي القليل',
      subtitle: `تبقّى ${tasksAr(today.remaining)} فقط وتقفل يومك بالكامل.`,
    };
  }

  if (today.percent >= 40) {
    return {
      title: 'أنت في المسار',
      subtitle: `أنجزت ${today.done} حتى الآن، وبقي ${today.remaining} لختام مريح.`,
    };
  }

  return {
    title: 'يومك يحتاج دفعة',
    subtitle: `أنجزت ${today.done} حتى الآن — كمّل بمهمة واحدة الآن.`,
  };
}

/**
 * حلقة التقدم اليومية — عدّاد (Meter):
 * التعبئة بلون التمييز، والمسار غير الممتلئ درجة أفتح من نفس اللون
 * (وليس رمادياً محايداً) حتى تُقرأ الحالة على امتداد الحلقة كلها.
 * الرقم في المنتصف بحبر النص — اللون للحلقة، والقيمة للنص.
 */
function ProgressRing({ percent, empty }) {
  const R = 52;
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
      <svg viewBox="0 0 120 120">
        <circle className="ring-track" cx="60" cy="60" r={R} strokeWidth="10" />
        <circle
          className="ring-fill"
          cx="60"
          cy="60"
          r={R}
          strokeWidth="10"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - shown / 100)}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <span className="ring-value">{empty ? '—' : `${percent}٪`}</span>
    </div>
  );
}

/**
 * عدّاد مهام اليوم أسفل البطل:
 * حتى ١٤ مهمة يظهر كمقاطع منفصلة (مقطع لكل مهمة) — أوضح وأصدق،
 * وفوق ذلك شريط امتلاء متصل بنفس التدرّج.
 */
function TodayMeter({ today }) {
  if (today.total === 0) {
    return (
      <div className="sum-meter-row">
        <span className="sum-meter-hint">ابدأ بإضافة أول مهمة اليوم</span>
      </div>
    );
  }

  return (
    <div className="sum-meter-block">
      {today.total <= 14 ? (
        <div
          className="sum-meter"
          role="img"
          aria-label={`أنجزت ${today.done} من ${today.total}`}
        >
          {Array.from({ length: today.total }, (_, i) => (
            <span
              key={i}
              className={`sum-meter-seg${i < today.done ? ' done' : ''}`}
            />
          ))}
        </div>
      ) : (
        <div
          className="sum-meter sum-meter-solid"
          role="img"
          aria-label={`أنجزت ${today.done} من ${today.total}`}
        >
          <span
            className="sum-meter-fill"
            style={{ width: `${today.percent}%` }}
          />
        </div>
      )}
      <div className="sum-meter-row">
        <span className="sum-meter-main">
          أنجزت {today.done} من {today.total}
        </span>
        <span className="sum-meter-side">
          {today.remaining === 0 ? 'مكتمل' : `المتبقي ${today.remaining}`}
        </span>
      </div>
    </div>
  );
}

/**
 * أعمدة آخر ٧ أيام — سلسلة واحدة بأسلوب "الإبراز":
 * اليوم بلون التمييز والبقية بدرجة خافتة، والقيم تُكتب فوق
 * القمم انتقائياً (أعلى يوم + اليوم الحالي فقط) لا على كل عمود.
 */
function WeekChart({ days }) {
  const max = Math.max(...days.map((day) => day.count), 1);
  const hasAny = days.some((day) => day.count > 0);

  return (
    <div
      className="wk-chart"
      role="img"
      aria-label={`عدد المهام المنجزة يومياً خلال آخر سبعة أيام: ${days
        .map((day) => day.count)
        .join('، ')}`}
    >
      {days.map((day, index) => {
        const isToday = index === days.length - 1;
        const isMax = hasAny && day.count === max;
        // أقصى ارتفاع ٧٦٪ ليبقى متسع لرقم القمة فوق العمود
        const h = day.count === 0 ? 0 : Math.max(Math.round((day.count / max) * 76), 8);

        return (
          <div key={day.key} className="wk-col">
            <div className="wk-zone" style={h ? { '--h': `${h}%` } : undefined}>
              {day.count > 0 && (isToday || isMax) && (
                <span className="wk-cap">{day.count}</span>
              )}
              <span
                className={`wk-bar${isToday ? ' is-today' : ''}${h ? '' : ' is-zero'}`}
              />
            </div>
            <span className={`wk-day${isToday ? ' is-today' : ''}`}>
              {weekdayNarrowFmt.format(parseDateKey(day.key))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StatTile({ icon, value, unit, label, sub, warm = false }) {
  return (
    <div className="sum-card stat-tile">
      <div className="stat-tile-head">
        <span className={`stat-icon${warm ? ' warm' : ''}`}>{icon}</span>
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value">
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      <span className="stat-sub">{sub}</span>
    </div>
  );
}
