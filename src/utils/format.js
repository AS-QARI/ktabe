/* صيغ العرض العربية المشتركة */

export const PRIORITY_LABELS = ['عادي', 'متوسط', 'عالي'];

/** جمع "يوم" الصحيح نحوياً حسب العدد */
export function daysAr(n) {
  if (n === 0) return 'صفر أيام';
  if (n === 1) return 'يوم واحد';
  if (n === 2) return 'يومان';
  if (n <= 10) return `${n} أيام`;
  return `${n} يوماً`;
}

/** جمع "مهمة" */
export function tasksAr(n) {
  if (n === 1) return 'مهمة واحدة';
  if (n === 2) return 'مهمتان';
  if (n <= 10) return `${n} مهام`;
  return `${n} مهمة`;
}
