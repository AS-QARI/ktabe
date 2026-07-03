import { supabase } from '../lib/supabaseClient';

/* =====================================================================
   طبقة الوصول للبيانات (Data Access Layer)
   ---------------------------------------------------------------------
   كل قراءة أو كتابة لقاعدة البيانات في التطبيق كله تمر من هذا الملف
   حصرياً. لا يستورد أي مكوّن supabaseClient مباشرة — لو تغيّر مزوّد
   التخزين مستقبلاً، هذا هو الملف الوحيد الذي يُعدَّل.

   الأقسام:
   1. رمز الدخول (PIN)
   2. المهام (tasks)
   3. النصوص الحرة (entries)
   4. العدادات التنازلية (countdowns)
   5. التصدير والاستيراد
   6. التزامن اللحظي (Realtime)
   ===================================================================== */

/** يفكّ نتيجة Supabase: يرمي خطأً واضحاً أو يعيد البيانات */
function unwrap({ data, error }) {
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

/* ---------------------------------------------------------------------
   1. رمز الدخول (PIN)
   التحقق يتم داخل قاعدة البيانات عبر دوال RPC — الـ hash لا يصل
   للمتصفح أبداً، والمقارنة تجري بـ bcrypt على الخادم.
   --------------------------------------------------------------------- */

/** هل تم إعداد رمز دخول من قبل؟ (يحدد شاشة الإعداد الأول أو الدخول) */
export async function hasPin() {
  return unwrap(await supabase.rpc('has_pin'));
}

/** إعداد رمز الدخول لأول مرة (4-6 أرقام). يعيد false إن وُجد رمز مسبقاً */
export async function setupPin(pin) {
  return unwrap(await supabase.rpc('setup_pin', { p_pin: pin }));
}

/** التحقق من رمز الدخول. يعيد true عند التطابق */
export async function verifyPin(pin) {
  return unwrap(await supabase.rpc('verify_pin', { p_pin: pin }));
}

/** تغيير رمز الدخول — يتطلب الرمز القديم الصحيح */
export async function changePin(oldPin, newPin) {
  return unwrap(
    await supabase.rpc('change_pin', { p_old_pin: oldPin, p_new_pin: newPin })
  );
}

/* ---------------------------------------------------------------------
   2. المهام
   --------------------------------------------------------------------- */

export async function listTasks() {
  return unwrap(
    await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
  );
}

/** إضافة مهمة. fields: { title, description?, priority?, due_date? } */
export async function createTask(fields) {
  return unwrap(
    await supabase.from('tasks').insert(fields).select().single()
  );
}

export async function updateTask(id, patch) {
  return unwrap(
    await supabase.from('tasks').update(patch).eq('id', id).select().single()
  );
}

/** تأشير الإكمال — قاعدة عمل: completed_at تُملأ الآن أو تُفرَّغ عند التراجع */
export async function setTaskCompleted(id, done) {
  return updateTask(id, {
    is_completed: done,
    completed_at: done ? new Date().toISOString() : null,
  });
}

export async function deleteTask(id) {
  unwrap(await supabase.from('tasks').delete().eq('id', id));
}

/* ---------------------------------------------------------------------
   3. النصوص الحرة (يوميات/ملاحظات)
   --------------------------------------------------------------------- */

export async function listEntries() {
  return unwrap(
    await supabase
      .from('entries')
      .select('*')
      .order('updated_at', { ascending: false })
  );
}

/** إضافة نص. fields: { title?, content } */
export async function createEntry(fields) {
  return unwrap(
    await supabase.from('entries').insert(fields).select().single()
  );
}

export async function updateEntry(id, patch) {
  return unwrap(
    await supabase.from('entries').update(patch).eq('id', id).select().single()
  );
}

export async function deleteEntry(id) {
  unwrap(await supabase.from('entries').delete().eq('id', id));
}

/* ---------------------------------------------------------------------
   4. العدادات التنازلية
   --------------------------------------------------------------------- */

export async function listCountdowns() {
  return unwrap(
    await supabase
      .from('countdowns')
      .select('*')
      .order('target_date', { ascending: true })
  );
}

/** إضافة عداد. fields: { title, target_date } */
export async function createCountdown(fields) {
  return unwrap(
    await supabase.from('countdowns').insert(fields).select().single()
  );
}

export async function deleteCountdown(id) {
  unwrap(await supabase.from('countdowns').delete().eq('id', id));
}

/* ---------------------------------------------------------------------
   5. التصدير والاستيراد
   --------------------------------------------------------------------- */

/** كامل البيانات لحظة الطلب — تُستخدم للنسخ الاحتياطي وللملخص وللطباعة */
export async function exportAll() {
  const [tasks, entries, countdowns] = await Promise.all([
    listTasks(),
    listEntries(),
    listCountdowns(),
  ]);
  return {
    app: 'kitabi',
    version: 1,
    exported_at: new Date().toISOString(),
    tasks,
    entries,
    countdowns,
  };
}

/**
 * استعادة نسخة احتياطية: تمسح البيانات الحالية كلها ثم تُدخل بيانات
 * النسخة. عملية مدمّرة — التأكيد مسؤولية واجهة الاستخدام.
 */
export async function importAll(backup) {
  if (
    !backup ||
    backup.app !== 'kitabi' ||
    !Array.isArray(backup.tasks) ||
    !Array.isArray(backup.entries) ||
    !Array.isArray(backup.countdowns)
  ) {
    throw new Error('الملف ليس نسخة احتياطية صالحة من كتابي');
  }

  // مسح كل الصفوف (Supabase يشترط فلتراً مع delete — كل الصفوف لها created_at)
  const wipe = (table) =>
    supabase.from(table).delete().gte('created_at', '1970-01-01');
  unwrap(await wipe('tasks'));
  unwrap(await wipe('entries'));
  unwrap(await wipe('countdowns'));

  // الإدخال على دفعات (حد أمان لو كبرت البيانات مع السنين)
  const CHUNK = 500;
  const insertAll = async (table, rows) => {
    for (let i = 0; i < rows.length; i += CHUNK) {
      unwrap(await supabase.from(table).insert(rows.slice(i, i + CHUNK)));
    }
  };
  await insertAll('tasks', backup.tasks);
  await insertAll('entries', backup.entries);
  await insertAll('countdowns', backup.countdowns);
}

/* ---------------------------------------------------------------------
   6. التزامن اللحظي (Realtime)
   أي تعديل من أي جهاز يصل كإشعار، فتعيد الشاشات تحميل بياناتها —
   وهذا ما يجعل الجوال والكمبيوتر متزامنين دائماً.
   --------------------------------------------------------------------- */

/**
 * اشتراك بتغييرات جدول أو أكثر. يعيد دالة لإلغاء الاشتراك.
 * onChange تُستدعى عند أي إضافة/تعديل/حذف من أي جهاز.
 */
export function onTablesChange(tables, onChange) {
  // اسم فريد لكل اشتراك حتى لا تتصادم القنوات بين الشاشات
  const name = `sync-${tables.join('-')}-${Math.random().toString(36).slice(2, 8)}`;
  const channel = supabase.channel(name);
  for (const table of tables) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      onChange
    );
  }
  channel.subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
