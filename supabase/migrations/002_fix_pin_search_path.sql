-- =====================================================================
-- كتابي — Migration 002: إصلاح search_path لدوال رمز الدخول
-- ---------------------------------------------------------------------
-- على Supabase، إضافة pgcrypto مثبتة في مخطط extensions (وليس public)،
-- وكانت الدوال مقيدة بـ search_path = public فقط، فتفشل عند استدعاء
-- crypt() أو gen_salt() وقت التشغيل. الحل: إضافة extensions للمسار.
-- (دالة has_pin لا تستخدم pgcrypto فلا تحتاج تعديلاً)
-- =====================================================================

create or replace function public.setup_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_pin is null or p_pin !~ '^\d{4,6}$' then
    return false;
  end if;
  if exists (select 1 from app_settings where id = true) then
    return false;
  end if;
  insert into app_settings (id, pin_hash) values (true, crypt(p_pin, gen_salt('bf')));
  return true;
end;
$$;

create or replace function public.verify_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  h text;
begin
  select pin_hash into h from app_settings where id = true;
  if h is null or p_pin is null then
    return false;
  end if;
  if crypt(p_pin, h) = h then
    return true;
  end if;
  perform pg_sleep(0.3);
  return false;
end;
$$;

create or replace function public.change_pin(p_old_pin text, p_new_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  h text;
begin
  if p_new_pin is null or p_new_pin !~ '^\d{4,6}$' then
    return false;
  end if;
  select pin_hash into h from app_settings where id = true;
  if h is null or p_old_pin is null or crypt(p_old_pin, h) <> h then
    perform pg_sleep(0.3);
    return false;
  end if;
  update app_settings set pin_hash = crypt(p_new_pin, gen_salt('bf')) where id = true;
  return true;
end;
$$;
