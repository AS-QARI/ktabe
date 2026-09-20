import { createPortal } from 'react-dom';
import { formatDateWithYear, formatWeekday, parseDateKey } from '../../utils/dates';
import { buildDiaryReport } from '../../utils/diaryReport';
import './print.css';

const timeFmt = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', {
  hour: 'numeric',
  minute: '2-digit',
});

function dateTimeLabel(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : timeFmt.format(date);
}

function TaskCard({ task, goal = false, plannedDate = null }) {
  const done = task.status === 'done' || task.is_completed;
  const completedAt = dateTimeLabel(task.completed_at);
  const completedDate = task.completedDate ? formatDateWithYear(parseDateKey(task.completedDate)) : null;

  return (
    <li className={`print-task-card status-${task.status}`} style={{ '--indent': `${(task.depth || 0) * 5}mm` }}>
      <header>
        <span className="print-task-number">{task.index}</span>
        <strong>{task.title}</strong>
        <span className="print-status">{goal ? `${task.progress || 0}%` : task.statusLabel}</span>
      </header>
      {!goal && done && (
        <p className="print-task-event">
          {task.completedOrder
            ? `الإنجاز رقم ${task.completedOrder} لهذا اليوم`
            : completedDate ? `أُنجزت في ${completedDate}` : 'أُنجزت المهمة'}
          {completedAt ? ` · ${completedAt}` : ''}
        </p>
      )}
      {!goal && task.status === 'postponed' && <p className="print-task-event">مؤجلة لحين تحديد موعد جديد</p>}
      {plannedDate && <p className="print-original-date">موعدها كان {formatDateWithYear(parseDateKey(plannedDate))}</p>}
      {task.description && <section className="print-description"><h5>الوصف</h5><p>{task.description}</p></section>}
      {goal && (task.progress_entries || []).length > 0 && (
        <section className="print-progress-history">
          <h5>سجل التقدم</h5>
          {task.progress_entries.map((entry) => (
            <p key={entry.id}>{entry.progress}% · {entry.note || 'تحديث نسبة الإنجاز'}</p>
          ))}
        </section>
      )}
    </li>
  );
}

function DayReport({ day }) {
  const { total, done, postponed, remaining } = day.totals;
  return (
    <section className="print-day">
      <header className="print-day-head">
        <div>
          <span className="print-day-kicker">اليومية</span>
          <h2>{formatWeekday(day.date)}، {formatDateWithYear(day.date)}</h2>
        </div>
        <span className="print-day-score">{done}/{total}</span>
      </header>

      <div className="print-day-stats">
        <span>المهمات <b>{total}</b></span>
        <span>المكتملة <b>{done}</b></span>
        <span>المتبقية <b>{remaining}</b></span>
        {postponed > 0 && <span>المؤجلة <b>{postponed}</b></span>}
      </div>

      {day.tasks.length ? (
        <section className="print-section">
          <h3>مهمات اليوم</h3>
          <ol className="print-task-list">
            {day.tasks.map((task) => <TaskCard key={task.id} task={task} />)}
          </ol>
        </section>
      ) : <p className="print-empty">لا توجد مهمات مسجلة لهذا اليوم.</p>}

      {day.lateCompletedTasks.length > 0 && (
        <section className="print-section print-late-completed">
          <h3>مهمات أُنجزت من يوم سابق</h3>
          <ol className="print-task-list">
            {day.lateCompletedTasks.map((task) => <TaskCard key={task.id} task={task} plannedDate={task.plannedDate} />)}
          </ol>
        </section>
      )}

      {day.postponedTasks.length > 0 && (
        <section className="print-section print-postponed">
          <h3>مهمات تم تأجيلها</h3>
          <ul>
            {day.postponedTasks.map((task) => (
              <li key={task.id}><strong>{task.title}</strong> <span>{task.toDate ? `نُقلت إلى ${formatDateWithYear(parseDateKey(task.toDate))}` : 'نُقلت إلى موعد جديد'}</span></li>
            ))}
          </ul>
        </section>
      )}

      {day.notes.length > 0 && (
        <section className="print-section print-notes">
          <h3>ملاحظات اليوم</h3>
          {day.notes.map((note) => (
            <article key={note.id} className="print-note">
              {note.title && <h4>{note.title}</h4>}
              {note.lines.map((line, index) => <p key={index}>{line}</p>)}
            </article>
          ))}
        </section>
      )}
    </section>
  );
}

/** صفحة طباعة منظمة؛ المتصفح يحفظها PDF من مربع الطباعة الأصلي. */
export default function PrintView({ data, selection }) {
  const report = buildDiaryReport(data, selection);

  return createPortal(
    <main className="print-view" dir="rtl">
      <header className="print-cover">
        <span>كتابي</span>
        <h1>{report.title}</h1>
        <p>أُعدّ في {formatDateWithYear(report.generatedAt)} · {report.totalTasks} مهمة ضمن التقرير</p>
      </header>

      {report.reportDays.length ? report.reportDays.map((day) => <DayReport key={day.key} day={day} />) : (
        <p className="print-empty print-empty-main">لا توجد يوميات أو مهمات ضمن هذا النطاق.</p>
      )}

      {report.pinnedGoals.length > 0 && (
        <section className="print-goals">
          <header><span>أهداف طويلة المدى</span><h2>الأهداف المثبّتة</h2></header>
          <ol className="print-task-list">
            {report.pinnedGoals.map((goal) => <TaskCard key={goal.id} task={goal} goal />)}
          </ol>
        </section>
      )}

      <footer className="print-footer">كتابي · ملخص شخصي محفوظ محليًا</footer>
    </main>,
    document.body
  );
}
