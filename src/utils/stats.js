import { toDateKey, todayKey, diffDaysBetweenKeys } from './dates';

/* حسابات الملخص — كلها من البيانات الخام بالتوقيت المحلي للجهاز.
   الأحجام صغيرة (تطبيق شخصي) فالحساب في المتصفح أبسط وأدق من SQL
   لأن "اليوم" يُعرَّف بمنطقة المستخدم الزمنية لا بمنطقة الخادم. */

/** مفتاح اليوم المحلي لطابع زمني، أو null */
function dayOf(timestamp) {
  return timestamp ? toDateKey(new Date(timestamp)) : null;
}

/**
 * ملخص اليوم: "أنجزت X من Y"
 * مهام اليوم = المستحقة اليوم (أياً كانت حالتها) + ما أُنجز اليوم من غيرها
 * — فالمهمة التي أنجزتها اليوم تُحسب لك حتى لو لم تكن مجدولة لهذا اليوم.
 */
export function computeTodayProgress(tasks) {
  const today = todayKey();
  const dueToday = tasks.filter((t) => t.due_date === today);
  const doneExtra = tasks.filter(
    (t) => t.due_date !== today && dayOf(t.completed_at) === today
  );
  const total = dueToday.length + doneExtra.length;
  const done = dueToday.filter((t) => t.is_completed).length + doneExtra.length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/**
 * أطول سلسلة أيام متتالية فيها إنجاز — قاعدة عمل:
 * أكبر عدد أيام متتالية سُجّل في كل منها completed_at لمهمة واحدة على الأقل
 */
export function computeLongestStreak(tasks) {
  const days = [...new Set(tasks.map((t) => dayOf(t.completed_at)).filter(Boolean))].sort();
  let longest = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && diffDaysBetweenKeys(days[i - 1], days[i]) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  return longest;
}

/** أيام الاستخدام: أيام مميزة حصل فيها أي نشاط (إنشاء/إنجاز/تعديل) */
export function computeUsageDays({ tasks, entries, countdowns }) {
  const days = new Set();
  for (const t of tasks) {
    days.add(dayOf(t.created_at));
    if (t.completed_at) days.add(dayOf(t.completed_at));
  }
  for (const e of entries) {
    days.add(dayOf(e.created_at));
    days.add(dayOf(e.updated_at));
  }
  for (const c of countdowns) {
    days.add(dayOf(c.created_at));
  }
  days.delete(null);
  return days.size;
}

/** كل مقاييس الملخص الشامل دفعة واحدة */
export function computeOverallStats(data) {
  return {
    totalCompleted: data.tasks.filter((t) => t.is_completed).length,
    notesCount: data.entries.length,
    longestStreak: computeLongestStreak(data.tasks),
    usageDays: computeUsageDays(data),
  };
}
