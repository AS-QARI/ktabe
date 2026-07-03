import { toDateKey, todayKey, diffDaysBetweenKeys } from './dates';

/* حسابات الملخص — من بيانات نموذج الدفتر (صفحات + سطور).
   الأحجام صغيرة (تطبيق شخصي) فالحساب في المتصفح أبسط وأدق من SQL
   لأن "اليوم" يُعرَّف بمنطقة المستخدم الزمنية لا بمنطقة الخادم. */

/** مفتاح اليوم المحلي لطابع زمني، أو null */
function dayOf(timestamp) {
  return timestamp ? toDateKey(new Date(timestamp)) : null;
}

function taskBlocks(data) {
  return data.blocks.filter((b) => b.kind === 'task');
}

/**
 * ملخص اليوم: "أنجزت X من Y"
 * مهام اليوم = مهام صفحات اليوم (أياً كانت حالتها) + ما أُنجز اليوم
 * من صفحات أخرى — فالمهمة التي أنجزتها اليوم تُحسب لك أينما كُتبت.
 */
export function computeTodayProgress(data) {
  const today = todayKey();
  const todayPageIds = new Set(
    data.pages.filter((p) => p.page_date === today).map((p) => p.id)
  );
  const tasks = taskBlocks(data);
  const onToday = tasks.filter((t) => todayPageIds.has(t.page_id));
  const doneElsewhere = tasks.filter(
    (t) => !todayPageIds.has(t.page_id) && dayOf(t.completed_at) === today
  );
  const total = onToday.length + doneElsewhere.length;
  const done =
    onToday.filter((t) => t.is_completed).length + doneElsewhere.length;
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

/**
 * أطول سلسلة أيام متتالية فيها إنجاز — قاعدة عمل:
 * أكبر عدد أيام متتالية سُجّل في كل منها إكمال مهمة واحدة على الأقل
 */
export function computeLongestStreak(data) {
  const days = [
    ...new Set(taskBlocks(data).map((t) => dayOf(t.completed_at)).filter(Boolean)),
  ].sort();
  let longest = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && diffDaysBetweenKeys(days[i - 1], days[i]) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  return longest;
}

/** أيام الاستخدام: أيام مميزة حصل فيها أي نشاط */
export function computeUsageDays(data) {
  const days = new Set();
  for (const p of data.pages) {
    days.add(p.page_date);
  }
  for (const b of data.blocks) {
    days.add(dayOf(b.created_at));
    if (b.completed_at) days.add(dayOf(b.completed_at));
  }
  for (const c of data.countdowns) {
    days.add(dayOf(c.created_at));
  }
  days.delete(null);
  return days.size;
}

/** كل مقاييس الملخص الشامل دفعة واحدة */
export function computeOverallStats(data) {
  return {
    totalCompleted: taskBlocks(data).filter((t) => t.is_completed).length,
    pagesCount: data.pages.length,
    longestStreak: computeLongestStreak(data),
    usageDays: computeUsageDays(data),
  };
}
