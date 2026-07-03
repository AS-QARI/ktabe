import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    'إعدادات Supabase ناقصة: أنشئ ملف .env.local وفيه VITE_SUPABASE_URL و VITE_SUPABASE_PUBLISHABLE_KEY (انظر .env.example)'
  );
}

export const supabase = createClient(url, key, {
  // لا نستخدم نظام حسابات Supabase إطلاقاً — الحماية عبر PIN فقط
  auth: { persistSession: false },
});
