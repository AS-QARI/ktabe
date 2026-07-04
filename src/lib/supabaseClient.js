import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigError =
  !url || !key
    ? 'إعدادات Supabase ناقصة. أضف VITE_SUPABASE_URL و VITE_SUPABASE_PUBLISHABLE_KEY في GitHub Actions secrets.'
    : null;

export const supabase = supabaseConfigError
  ? null
  : createClient(url, key, {
      // لا نستخدم نظام حسابات Supabase إطلاقاً — الحماية عبر PIN فقط
      auth: { persistSession: false },
    });

