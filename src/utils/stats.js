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

function completedTasks(data) {
  return taskBlocks(data).filter((t) => t.is_completed);
}

function completionDays(data) {
  return [...new Set(completedTasks(data).map((t) => dayOf(t.completed_at)).filter(Boolean))].sort();
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
    remaining: Math.max(total - done, 0),
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

/**
 * أطول سلسلة أيام متتالية فيها إنجاز — قاعدة عمل:
 * أكبر عدد أيام متتالية سُجّل في كل منها إكمال مهمة واحدة على الأقل
 */
export function computeLongestStreak(data) {
  const days = completionDays(data);
  let longest = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && diffDaysBetweenKeys(days[i - 1], days[i]) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  return longest;
}

/** السلسلة الحالية: متتالية الأيام المنتهية اليوم أو أمس */
export function computeCurrentStreak(data) {
  const days = completionDays(data);
  if (!days.length) return 0;

  const lastDay = days[days.length - 1];
  if (diffDaysBetweenKeys(lastDay, todayKey()) > 1) return 0;

  let run = 1;
  for (let i = days.length - 1; i > 0; i--) {
    if (diffDaysBetweenKeys(days[i - 1], days[i]) !== 1) break;
    run += 1;
  }
  return run;
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

/** آخر 7 أيام: إنجاز يومي + اليوم الأفضل + عدد الأيام النشطة */
export function computeWeeklyStats(data) {
  const counts = new Map();

  for (const task of completedTasks(data)) {
    const key = dayOf(task.completed_at);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = toDateKey(date);
    return { key, count: counts.get(key) ?? 0 };
  });

  const completedTotal = days.reduce((sum, day) => sum + day.count, 0);
  const activeDays = days.filter((day) => day.count > 0).length;
  const bestDay =
    days.reduce(
      (best, day) => (day.count > (best?.count ?? 0) ? day : best),
      null
    ) ?? null;

  return {
    days,
    completedTotal,
    activeDays,
    bestDay: bestDay?.count ? bestDay : null,
  };
}

/** كل مقاييس الملخص الشامل دفعة واحدة */
export function computeOverallStats(data) {
  return {
    totalCompleted: completedTasks(data).length,
    pagesCount: data.pages.length,
    currentStreak: computeCurrentStreak(data),
    longestStreak: computeLongestStreak(data),
    usageDays: computeUsageDays(data),
  };
}
