import { createPortal } from 'react-dom';
import { formatDateWithYear, formatWeekday, parseDateKey } from '../../utils/dates';
import './print.css';

/**
 * نسخة الطباعة — تُركّب خارج شجرة التطبيق (Portal) وتظهر فقط في وضع
 * الطباعة. نستخدم حوار طباعة المتصفح نفسه ("حفظ كـ PDF"): تشكيل عربي
 * مثالي بلا أي مكتبة خارجية، ويعمل على الجوال والكمبيوتر.
 */
export default function PrintView({ data }) {
  const tasksCount = data.blocks.filter((b) => b.kind === 'task').length;

  return createPortal(
    <div className="print-view" dir="rtl">
      <h1>كتابي — النسخة الكاملة</h1>
      <p className="print-meta">
        تاريخ التصدير: {formatDateWithYear(new Date(data.exported_at))} —{' '}
        {data.pages.length} صفحة، {tasksCount} مهمة، {data.countdowns.length} عداد
      </p>

      <h2>الصفحات ({data.pages.length})</h2>
      {data.pages.length === 0 ? (
        <p className="print-empty">لا صفحات.</p>
      ) : (
        data.pages.map((p) => {
          const pageBlocks = data.blocks.filter((b) => b.page_id === p.id);
          const roots = pageBlocks
            .filter((b) => !b.parent_id)
            .sort((a, b) => a.position - b.position);
          const d = parseDateKey(p.page_date);
          return (
            <section key={p.id} className="print-page">
              <h3>
                {formatWeekday(d)}، {formatDateWithYear(d)}
                {p.page_no > 1 ? ` — صفحة ${p.page_no}` : ''}
              </h3>
              {roots.length === 0 ? (
                <p className="print-empty">صفحة فارغة.</p>
              ) : (
                <ul className="print-lines">
                  {roots.map((r) => {
                    const kids = pageBlocks
                      .filter((b) => b.parent_id === r.id)
                      .sort((a, b) => a.position - b.position);
                    return (
                      <li key={r.id} className={r.kind === 'task' ? 'print-task' : ''}>
                        {r.kind === 'task' ? (r.is_completed ? '☑ ' : '☐ ') : ''}
                        {r.content}
                        {kids.length > 0 && (
                          <ul className="print-lines sub">
                            {kids.map((k) => (
                              <li key={k.id} className={k.kind === 'task' ? 'print-task' : ''}>
                                {k.kind === 'task' ? (k.is_completed ? '☑ ' : '☐ ') : ''}
                                {k.content}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })
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
