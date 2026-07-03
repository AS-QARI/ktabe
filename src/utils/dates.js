/* أدوات التواريخ — كل الحسابات بالتوقيت المحلي للجهاز.
   نستخدم مفاتيح نصية 'YYYY-MM-DD' (نفس صيغة عمود date في القاعدة)
   لتفادي أخطاء المناطق الزمنية عند المقارنة. */

/** Date → 'YYYY-MM-DD' بالتوقيت المحلي */
export function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 'YYYY-MM-DD' → Date محلي (منتصف الليل محلياً، وليس UTC) */
export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey() {
  return toDateKey(new Date());
}

/** فرق الأيام الكاملة بين مفتاحي تاريخ (موجب إذا كان to بعد from) */
export function diffDaysBetweenKeys(fromKey, toKey) {
  const ms = parseDateKey(toKey) - parseDateKey(fromKey);
  return Math.round(ms / 86400000);
}

/** إزاحة مفتاح تاريخ بعدد أيام (سالب = للخلف) */
export function shiftDateKey(key, delta) {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + delta);
  return toDateKey(d);
}

/* التقويم الميلادي بالعربية مع أرقام لاتينية —
   مهم: ar-SA وحدها قد تعطي التقويم الهجري، لذا نحدد gregory صراحة */
const AR_LOCALE = 'ar-u-ca-gregory-nu-latn';

const fullFmt = new Intl.DateTimeFormat(AR_LOCALE, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const shortFmt = new Intl.DateTimeFormat(AR_LOCALE, {
  day: 'numeric',
  month: 'long',
});

const monthYearFmt = new Intl.DateTimeFormat(AR_LOCALE, {
  month: 'long',
  year: 'numeric',
});

const fullWithYearFmt = new Intl.DateTimeFormat(AR_LOCALE, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** "الخميس، 3 يوليو" */
export function formatFullDate(d) {
  return fullFmt.format(d);
}

const weekdayFmt = new Intl.DateTimeFormat(AR_LOCALE, { weekday: 'long' });

/** "الخميس" */
export function formatWeekday(d) {
  return weekdayFmt.format(d);
}

/** "يوليو 2026" — عنوان شهر التقويم */
export function formatMonthYear(d) {
  return monthYearFmt.format(d);
}

/** "3 يوليو 2026" */
export function formatDateWithYear(d) {
  return fullWithYearFmt.format(d);
}

/** تسمية قريبة وودّية لمفتاح تاريخ: اليوم / غداً / أمس / "3 يوليو" */
export function relativeDayLabel(key) {
  const diff = diffDaysBetweenKeys(todayKey(), key);
  if (diff === 0) return 'اليوم';
  if (diff === 1) return 'غداً';
  if (diff === -1) return 'أمس';
  return shortFmt.format(parseDateKey(key));
}

/** أسماء أيام الأسبوع المختصرة، بدءاً من الأحد (بداية الأسبوع في السعودية) */
export function weekdayNames() {
  const fmt = new Intl.DateTimeFormat(AR_LOCALE, { weekday: 'narrow' });
  // 2026-07-05 يوم أحد — نولّد الأسبوع انطلاقاً منه
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2026, 6, 5 + i)));
}

/**
 * يبني شبكة الشهر: مصفوفة خلايا تبدأ ببداية أسبوع (الأحد)،
 * كل خلية { key, day, inMonth } — والفراغات قبل أول يوم خلايا فارغة (null)
 */
export function buildMonthGrid(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay(); // 0 = أحد

  const cells = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ key: toDateKey(new Date(year, month, d)), day: d });
  }
  return cells;
}
