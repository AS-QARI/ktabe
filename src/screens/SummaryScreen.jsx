import { useEffect, useMemo, useState } from 'react';
import { exportAll } from '../data/storage';
import { useLiveData } from '../hooks/useLiveData';
import { computeTodayProgress, computeOverallStats } from '../utils/stats';
import { tasksAr } from '../utils/format';
import {
  GearIcon,
  CheckIcon,
  NoteIcon,
  FlameIcon,
  CalendarIcon,
} from '../components/ui/Icons';
import './screens.css';
import './SummaryScreen.css';

const ALL_TABLES = ['pages', 'blocks', 'countdowns'];

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

  return (
    <main className="screen">
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
          {/* ---------- بطاقة اليوم ---------- */}
          <section className="today-card" aria-label="إنجاز اليوم">
            <ProgressRing percent={today.percent} empty={today.total === 0} />
            <div className="today-text">
              <h2>إنجاز اليوم</h2>
              {today.total === 0 ? (
                <p>لا مهام في صفحة اليوم بعد — اكتب سطراً وحوّله لمهمة</p>
              ) : (
                <p>
                  أنجزت <strong>{today.done}</strong> من {tasksAr(today.total)}
                </p>
              )}
            </div>
          </section>

          {/* ---------- الملخص الشامل ---------- */}
          <div className="section-header">
            <h2>منذ البداية</h2>
          </div>
          <div className="stats-grid">
            <StatTile
              icon={<CheckIcon size={20} />}
              value={overall.totalCompleted}
              label="مهمة منجزة"
            />
            <StatTile
              icon={<NoteIcon size={20} />}
              value={overall.pagesCount}
              label="صفحة مكتوبة"
            />
            <StatTile
              icon={<FlameIcon size={20} />}
              value={overall.longestStreak}
              label="أطول سلسلة إنجاز (أيام متتالية)"
            />
            <StatTile
              icon={<CalendarIcon size={20} />}
              value={overall.usageDays}
              label="يوم استخدام"
            />
          </div>
        </>
      ) : null}
    </main>
  );
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

/** بطاقة إحصائية: القيمة بحبر النص، الأيقونة تحمل لون التمييز */
function StatTile({ icon, value, label }) {
  return (
    <div className="stat-tile">
      <span className="stat-icon">{icon}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
