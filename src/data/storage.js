import { supabase } from '../lib/supabaseClient';

/* =====================================================================
   طبقة الوصول للبيانات (Data Access Layer)
   ---------------------------------------------------------------------
   كل قراءة أو كتابة لقاعدة البيانات في التطبيق كله تمر من هذا الملف
   حصرياً. لا يستورد أي مكوّن supabaseClient مباشرة — لو تغيّر مزوّد
   التخزين مستقبلاً، هذا هو الملف الوحيد الذي يُعدَّل.

   نموذج البيانات (نموذج "الدفتر"):
   - pages: ورقة ليوم محدد (page_date) — واليوم الواحد قد يملك أكثر
     من صفحة (page_no: 1، 2، ...)
   - blocks: سطور الصفحة — نص حر أو مهمة (kind)، وقد يكون السطر
     فرعياً تحت مهمة (parent_id) كمهمة جانبية أو تعليق
   - countdowns: العدادات التنازلية
   - app_settings: رمز الدخول (عبر دوال RPC فقط)
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

export async function hasPin() {
  return unwrap(await supabase.rpc('has_pin'));
}

export async function setupPin(pin) {
  return unwrap(await supabase.rpc('setup_pin', { p_pin: pin }));
}

export async function verifyPin(pin) {
  return unwrap(await supabase.rpc('verify_pin', { p_pin: pin }));
}

export async function changePin(oldPin, newPin) {
  return unwrap(
    await supabase.rpc('change_pin', { p_old_pin: oldPin, p_new_pin: newPin })
  );
}

/* ---------------------------------------------------------------------
   2. الصفحات اليومية
   --------------------------------------------------------------------- */

/** صفحات يوم محدد مع سطورها، مرتبة (رقم الصفحة ثم موضع السطر) */
export async function getDayPages(dateKey) {
  return unwrap(
    await supabase
      .from('pages')
      .select('*, blocks(*)')
      .eq('page_date', dateKey)
      .order('page_no')
      .order('position', { referencedTable: 'blocks' })
  );
}

/** إنشاء صفحة جديدة ليوم (رقمها التالي تلقائياً حسب الموجود) */
export async function createPage(dateKey, pageNo) {
  return unwrap(
    await supabase
      .from('pages')
      .insert({ page_date: dateKey, page_no: pageNo })
      .select()
      .single()
  );
}

export async function deletePage(id) {
  unwrap(await supabase.from('pages').delete().eq('id', id));
}

/* ---------------------------------------------------------------------
   3. السطور (blocks)
   --------------------------------------------------------------------- */

/** إضافة سطر. fields: { page_id, kind, content, parent_id?, position } */
export async function createBlock(fields) {
  return unwrap(
    await supabase.from('blocks').insert(fields).select().single()
  );
}

export async function updateBlock(id, patch) {
  return unwrap(
    await supabase.from('blocks').update(patch).eq('id', id).select().single()
  );
}

/** تأشير الإكمال — قاعدة عمل: completed_at تُملأ الآن أو تُفرَّغ */
export async function setBlockCompleted(id, done) {
  return updateBlock(id, {
    is_completed: done,
    completed_at: done ? new Date().toISOString() : null,
  });
}

export async function deleteBlock(id) {
  unwrap(await supabase.from('blocks').delete().eq('id', id));
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

export async function createCountdown(fields) {
  return unwrap(
    await supabase.from('countdowns').insert(fields).select().single()
  );
}

export async function deleteCountdown(id) {
  unwrap(await supabase.from('countdowns').delete().eq('id', id));
}

/* ---------------------------------------------------------------------
   5. التصدير والاستيراد (نسخة v2 — نموذج الدفتر)
   --------------------------------------------------------------------- */

/** كامل البيانات لحظة الطلب — للنسخ الاحتياطي وللملخص وللتقويم وللطباعة */
export async function exportAll() {
  const [pages, blocks, countdowns] = await Promise.all([
    unwrap(await supabase.from('pages').select('*').order('page_date').order('page_no')),
    unwrap(await supabase.from('blocks').select('*').order('position')),
    listCountdowns(),
  ]);
  return {
    app: 'kitabi',
    version: 2,
    exported_at: new Date().toISOString(),
    pages,
    blocks,
    countdowns,
  };
}

/**
 * استعادة نسخة احتياطية (v2): تمسح البيانات الحالية كلها ثم تُدخل
 * بيانات النسخة. عملية مدمّرة — التأكيد مسؤولية واجهة الاستخدام.
 */
export async function importAll(backup) {
  if (
    !backup ||
    backup.app !== 'kitabi' ||
    backup.version !== 2 ||
    !Array.isArray(backup.pages) ||
    !Array.isArray(backup.blocks) ||
    !Array.isArray(backup.countdowns)
  ) {
    throw new Error('الملف ليس نسخة احتياطية صالحة من كتابي (الإصدار 2)');
  }

  const wipe = (table) =>
    supabase.from(table).delete().gte('created_at', '1970-01-01');
  unwrap(await wipe('blocks'));
  unwrap(await wipe('pages'));
  unwrap(await wipe('countdowns'));

  const CHUNK = 500;
  const insertAll = async (table, rows) => {
    for (let i = 0; i < rows.length; i += CHUNK) {
      unwrap(await supabase.from(table).insert(rows.slice(i, i + CHUNK)));
    }
  };

  await insertAll('pages', backup.pages);
  // السطور الفرعية تشير لآبائها (FK) — ندخل الجذور أولاً ثم الأبناء
  const roots = backup.blocks.filter((b) => !b.parent_id);
  const children = backup.blocks.filter((b) => b.parent_id);
  await insertAll('blocks', roots);
  await insertAll('blocks', children);
  await insertAll('countdowns', backup.countdowns);
}

/* ---------------------------------------------------------------------
   6. التزامن اللحظي (Realtime)
   --------------------------------------------------------------------- */

/**
 * اشتراك بتغييرات جدول أو أكثر. يعيد دالة لإلغاء الاشتراك.
 * onChange تُستدعى عند أي إضافة/تعديل/حذف من أي جهاز.
 */
export function onTablesChange(tables, onChange) {
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
