import { createPortal } from 'react-dom';
import { formatDateWithYear, parseDateKey } from '../../utils/dates';
import { PRIORITY_LABELS } from '../../utils/format';
import './print.css';

/**
 * نسخة الطباعة — تُركّب خارج شجرة التطبيق (Portal) وتظهر فقط في وضع
 * الطباعة. نستخدم حوار طباعة المتصفح نفسه ("حفظ كـ PDF"): تشكيل عربي
 * مثالي بلا أي مكتبة خارجية، ويعمل على الجوال والكمبيوتر.
 */
export default function PrintView({ data }) {
  return createPortal(
    <div className="print-view" dir="rtl">
      <h1>كتابي — النسخة الكاملة</h1>
      <p className="print-meta">
        تاريخ التصدير: {formatDateWithYear(new Date(data.exported_at))}
      </p>

      <h2>المهام ({data.tasks.length})</h2>
      {data.tasks.length === 0 ? (
        <p className="print-empty">لا مهام.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>الحالة</th>
              <th>المهمة</th>
              <th>الأولوية</th>
              <th>الاستحقاق</th>
              <th>أُنجزت في</th>
            </tr>
          </thead>
          <tbody>
            {data.tasks.map((t) => (
              <tr key={t.id}>
                <td>{t.is_completed ? '✓' : '☐'}</td>
                <td>
                  {t.title}
                  {t.description && (
                    <div className="print-desc">{t.description}</div>
                  )}
                </td>
                <td>{PRIORITY_LABELS[t.priority] ?? '—'}</td>
                <td>{t.due_date ? formatDateWithYear(parseDateKey(t.due_date)) : '—'}</td>
                <td>{t.completed_at ? formatDateWithYear(new Date(t.completed_at)) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>اليوميات ({data.entries.length})</h2>
      {data.entries.length === 0 ? (
        <p className="print-empty">لا ملاحظات.</p>
      ) : (
        data.entries.map((e) => (
          <article key={e.id} className="print-entry">
            <h3>{e.title || 'بدون عنوان'}</h3>
            <p className="print-meta">
              {formatDateWithYear(new Date(e.created_at))}
            </p>
            <p className="print-content">{e.content}</p>
          </article>
        ))
      )}

      <h2>العدادات التنازلية ({data.countdowns.length})</h2>
      {data.countdowns.length === 0 ? (
        <p className="print-empty">لا عدادات.</p>
      ) : (
        <ul className="print-countdowns">
          {data.countdowns.map((c) => (
            <li key={c.id}>
              {c.title} — {formatDateWithYear(parseDateKey(c.target_date))}
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body
  );
}
