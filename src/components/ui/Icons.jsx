/* أيقونات التطبيق — نمط موحّد: خط واحد (Outline)، رؤوس دائرية،
   سماكة 1.8 افتراضياً، بأسلوب SF Symbols. كل الأيقونات من هذا الملف
   فقط لضمان الاتساق البصري. */

function Svg({ size = 24, strokeWidth = 1.8, children, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** كتاب — شعار التطبيق */
export function BookIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </Svg>
  );
}

/** قائمة مهام — تبويب المهام */
export function ChecklistIcon(props) {
  return (
    <Svg {...props}>
      <path d="M3.5 6.5 5 8l3-3.5" />
      <path d="M3.5 15.5 5 17l3-3.5" />
      <path d="M12 7h8.5" />
      <path d="M12 16h8.5" />
    </Svg>
  );
}

/** تقويم — تبويب التقويم */
export function CalendarIcon(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="16" rx="3.5" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </Svg>
  );
}

/** أعمدة إحصائية — تبويب الملخص */
export function ChartIcon(props) {
  return (
    <Svg {...props}>
      <path d="M5.5 20v-6" />
      <path d="M12 20V9" />
      <path d="M18.5 20V4.5" />
    </Svg>
  );
}

/** مسح رقم (Backspace) */
export function BackspaceIcon(props) {
  return (
    <Svg {...props}>
      <path d="M21 6.5H9.2a2 2 0 0 0-1.55.74L3 12l4.65 4.76a2 2 0 0 0 1.55.74H21a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1z" />
      <path d="m11.5 9.5 5 5" />
      <path d="m16.5 9.5-5 5" />
    </Svg>
  );
}

/** علامة صح — تأكيد */
export function CheckIcon(props) {
  return (
    <Svg strokeWidth={2.4} {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Svg>
  );
}
