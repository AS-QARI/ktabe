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

/** إضافة */
export function PlusIcon(props) {
  return (
    <Svg strokeWidth={2} {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Svg>
  );
}

/** إغلاق */
export function XIcon(props) {
  return (
    <Svg strokeWidth={2} {...props}>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </Svg>
  );
}

/** حذف (سلة) */
export function TrashIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 13a1.5 1.5 0 0 0 1.5 1.3h7A1.5 1.5 0 0 0 17 20l1-13" />
      <path d="M9 7V4.8A1.3 1.3 0 0 1 10.3 3.5h3.4A1.3 1.3 0 0 1 15 4.8V7" />
    </Svg>
  );
}

/** إعدادات (ترس) */
export function GearIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V19.6a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 17.96a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H2.9a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.55 7.5a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1.03-1.56V1.5" transform="translate(0 1.5) scale(0.95)" />
    </Svg>
  );
}

/** سهم يسار (للتنقل بين الشهور) */
export function ChevronLeftIcon(props) {
  return (
    <Svg strokeWidth={2.2} {...props}>
      <path d="m14.5 5.5-6 6.5 6 6.5" />
    </Svg>
  );
}

/** سهم يمين */
export function ChevronRightIcon(props) {
  return (
    <Svg strokeWidth={2.2} {...props}>
      <path d="m9.5 5.5 6 6.5-6 6.5" />
    </Svg>
  );
}

/** ورقة ملاحظة — اليوميات */
export function NoteIcon(props) {
  return (
    <Svg {...props}>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h3.5" />
    </Svg>
  );
}

/** ساعة رملية — العدادات التنازلية */
export function HourglassIcon(props) {
  return (
    <Svg {...props}>
      <path d="M7 3h10" />
      <path d="M7 21h10" />
      <path d="M8 3v3.5c0 2.5 4 4 4 5.5s-4 3-4 5.5V21" />
      <path d="M16 3v3.5c0 2.5-4 4-4 5.5s4 3 4 5.5V21" />
    </Svg>
  );
}

/** لهب — سلسلة الإنجاز */
export function FlameIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 21.5c3.6 0 6.5-2.6 6.5-6.4 0-3.2-2.1-5.3-3.7-7.3C13.4 6.1 12.7 4 12.7 2.5c-2.5 1.5-4 3.7-4 6 0 1.2.3 2 .3 2S7.5 9.8 7 8.5c-1 1.4-1.5 3-1.5 4.6 0 3.8 2.9 6.4 6.5 6.4z" />
    </Svg>
  );
}

/** تنزيل — تصدير JSON */
export function DownloadIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 3.5V15" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M4.5 20.5h15" />
    </Svg>
  );
}

/** رفع — استيراد JSON */
export function UploadIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 15V3.5" />
      <path d="M7.5 8 12 3.5 16.5 8" />
      <path d="M4.5 20.5h15" />
    </Svg>
  );
}

/** طابعة — تصدير PDF */
export function PrinterIcon(props) {
  return (
    <Svg {...props}>
      <path d="M7 8V3.5h10V8" />
      <rect x="3.5" y="8" width="17" height="9" rx="2" />
      <path d="M7 13.5h10V21H7z" />
    </Svg>
  );
}

/** حرف نص — تحويل مهمة إلى نص عادي */
export function TextIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 6V4h16v2" />
      <path d="M12 4v16" />
      <path d="M9 20h6" />
    </Svg>
  );
}

/** دائرة مهمة — تحويل نص إلى مهمة */
export function TaskCircleIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </Svg>
  );
}

/** إزاحة لسطر فرعي (مهمة جانبية/تعليق) */
export function IndentIcon(props) {
  return (
    <Svg {...props}>
      <path d="M21 6H8" />
      <path d="M21 12H8" />
      <path d="M21 18H8" />
      <path d="m5 9.5-2.5 2.5L5 14.5" />
    </Svg>
  );
}

/** إعادة السطر لمستوى رئيسي */
export function OutdentIcon(props) {
  return (
    <Svg {...props}>
      <path d="M21 6H8" />
      <path d="M21 12H8" />
      <path d="M21 18H8" />
      <path d="m2.5 9.5 2.5 2.5-2.5 2.5" />
    </Svg>
  );
}

/** تحديد نص — أقواس زوايا حول سطر */
export function SelectIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 8V6.5A2.5 2.5 0 0 1 6.5 4H8" />
      <path d="M16 4h1.5A2.5 2.5 0 0 1 20 6.5V8" />
      <path d="M20 16v1.5a2.5 2.5 0 0 1-2.5 2.5H16" />
      <path d="M8 20H6.5A2.5 2.5 0 0 1 4 17.5V16" />
      <path d="M9 12h6" />
    </Svg>
  );
}

/** نسخ */
export function CopyIcon(props) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M15 5.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h.5" />
    </Svg>
  );
}

/** قفل */
export function LockIcon(props) {
  return (
    <Svg {...props}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

/** خط عريض — Bold */
export function BoldIcon(props) {
  return (
    <Svg {...props}>
      <path d="M6 4h8a4 4 0 0 1 0 8H6z" strokeWidth={2} />
      <path d="M6 12h9a4.5 4.5 0 0 1 0 9H6z" strokeWidth={2} />
    </Svg>
  );
}

/** خط مائل — Italic */
export function ItalicIcon(props) {
  return (
    <Svg strokeWidth={2} {...props}>
      <path d="M10 4h8" />
      <path d="M6 20h8" />
      <path d="M14 4 10 20" />
    </Svg>
  );
}

/** تسطير — Underline */
export function UnderlineIcon(props) {
  return (
    <Svg strokeWidth={2} {...props}>
      <path d="M6.5 4v7a5.5 5.5 0 0 0 11 0V4" />
      <path d="M5 20.5h14" />
    </Svg>
  );
}

/** يتوسطه خط — Strikethrough */
export function StrikethroughIcon(props) {
  return (
    <Svg strokeWidth={2} {...props}>
      <path d="M17.5 6.5c-.8-1.8-2.9-2.9-5.4-2.9-3 0-5.1 1.6-5.1 4 0 1.6 1 2.7 3 3.4" />
      <path d="M9 17.5c.9 1.6 2.8 2.6 5 2.4 2.7-.2 4.5-1.8 4.3-4.1-.1-1.3-.9-2.2-2.3-2.9" />
      <path d="M4 12h16" />
    </Svg>
  );
}

/** تنسيق النص — Aa بأسلوب شريط ملاحظات آبل */
export function FormatIcon(props) {
  return (
    <Svg strokeWidth={2} {...props}>
      <path d="m3 18.5 5-13 5 13" />
      <path d="M4.9 13.7h6.2" />
      <path d="M21 18.5v-7" />
      <circle cx="18" cy="15.4" r="3" />
    </Svg>
  );
}

/** إخفاء لوحة المفاتيح — كيبورد مع سهم لأسفل */
export function KeyboardHideIcon(props) {
  return (
    <Svg {...props}>
      <rect x="2.5" y="3.5" width="19" height="11.5" rx="2.5" />
      <path d="M6 7h.01" />
      <path d="M9.7 7h.01" />
      <path d="M13.4 7h.01" />
      <path d="M17.1 7h.01" />
      <path d="M6 10h.01" />
      <path d="M9.7 10h.01" />
      <path d="M13.4 10h.01" />
      <path d="M17.1 10h.01" />
      <path d="M8.5 12.5h7" />
      <path d="m9.2 18.5 2.8 2.6 2.8-2.6" />
    </Svg>
  );
}

