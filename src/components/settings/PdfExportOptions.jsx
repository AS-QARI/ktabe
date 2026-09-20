import { useState } from 'react';

const OPTIONS = [
  { value: 'today', label: 'اليوم الحالي', hint: 'مهمات وملاحظات اليوم فقط' },
  { value: 'recent', label: 'آخر عدة أيام', hint: 'حدد عدد الأيام التي تريدها' },
  { value: 'all', label: 'كل المهمات', hint: 'كل اليوميات والمهمات منذ البداية' },
];

/** خيارات نطاق ملخص PDF؛ يبقى التنفيذ في ورقة الإعدادات لأنها ميزة غير يومية. */
export default function PdfExportOptions({ busy, onExport }) {
  const [range, setRange] = useState('today');
  const [days, setDays] = useState(7);

  const submit = (event) => {
    event.preventDefault();
    onExport({ range, days: Math.max(1, Math.min(Number(days) || 7, 90)) });
  };

  return (
    <form className="pdf-export-options" onSubmit={submit}>
      <p>اختر ما تريد أن يظهر في الملخص.</p>
      <div className="pdf-export-ranges" role="radiogroup" aria-label="نطاق ملخص PDF">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={range === option.value}
            className={range === option.value ? 'active' : ''}
            onClick={() => setRange(option.value)}
          >
            <strong>{option.label}</strong>
            <small>{option.hint}</small>
          </button>
        ))}
      </div>

      {range === 'recent' && (
        <label className="pdf-export-days">
          <span>عدد الأيام، شامل اليوم</span>
          <input
            type="number"
            min="1"
            max="90"
            inputMode="numeric"
            value={days}
            onChange={(event) => setDays(event.target.value)}
          />
        </label>
      )}

      <p className="pdf-export-hint">سيفتح مربع الطباعة؛ اختر «حفظ كـ PDF» أو المشاركة لحفظ الملف.</p>
      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? 'جارٍ تجهيز الملخص…' : 'تجهيز ملخص PDF'}
      </button>
    </form>
  );
}
