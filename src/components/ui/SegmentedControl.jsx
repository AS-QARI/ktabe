import './SegmentedControl.css';

/**
 * أداة تبديل مقسّمة بأسلوب iOS — تُستخدم لاختيار الأولوية.
 * options: [{ value, label }], value الحالي, onChange(value)
 */
export default function SegmentedControl({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={`segmented-item${value === opt.value ? ' active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
