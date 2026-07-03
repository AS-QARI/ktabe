import { supabase } from '../lib/supabaseClient';

/* =====================================================================
   طبقة الوصول للبيانات (Data Access Layer)
   ---------------------------------------------------------------------
   كل قراءة أو كتابة لقاعدة البيانات في التطبيق كله تمر من هذا الملف
   حصرياً. لا يستورد أي مكوّن supabaseClient مباشرة — لو تغيّر مزوّد
   التخزين مستقبلاً، هذا هو الملف الوحيد الذي يُعدَّل.

   الأقسام:
   1. رمز الدخول (PIN)      — هذه المرحلة
   2. المهام (tasks)         — المرحلة 2
   3. النصوص الحرة (entries) — المرحلة 2
   4. العدادات (countdowns)  — المرحلة 3
   5. الملخصات والتصدير      — المرحلتان 4 و5
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
