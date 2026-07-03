-- =====================================================================
-- كتابي (Kitabi) — Migration 001: البنية الأساسية
-- نظام أحادي المستخدم: لا جدول users، الحماية عبر PIN مخزّن كـ hash
-- =====================================================================

-- pgcrypto: نحتاجها لتشفير الـ PIN بخوارزمية bcrypt عبر crypt()
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- دالة مشتركة لتحديث updated_at تلقائياً عند أي تعديل
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- جدول المهام
-- due_date من نوع date (وليس timestamptz): الاستحقاق على مستوى اليوم،
-- وهذا يجنّبنا أخطاء المناطق الزمنية عند رسم التقويم
-- ---------------------------------------------------------------------
create table public.tasks (
    id uuid primary key default gen_random_uuid(),
    title text not null check (char_length(title) between 1 and 500),
    description text,
    is_completed boolean not null default false,
    priority smallint not null default 0 check (priority in (0, 1, 2)),
    due_date date,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- فهارس: التقويم يستعلم بالتاريخ، والملخص يستعلم بـ completed_at
create index tasks_due_date_idx on public.tasks (due_date) where due_date is not null;
create index tasks_completed_at_idx on public.tasks (completed_at) where completed_at is not null;
create index tasks_open_idx on public.tasks (is_completed, created_at desc);

-- ---------------------------------------------------------------------
-- جدول النصوص الحرة (يوميات/ملاحظات)
-- ---------------------------------------------------------------------
create table public.entries (
    id uuid primary key default gen_random_uuid(),
    title text check (title is null or char_length(title) <= 500),
    content text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();

-- القائمة تُعرض بترتيب آخر تعديل
create index entries_updated_at_idx on public.entries (updated_at desc);

-- ---------------------------------------------------------------------
-- جدول العدادات التنازلية
-- ---------------------------------------------------------------------
create table public.countdowns (
    id uuid primary key default gen_random_uuid(),
    title text not null check (char_length(title) between 1 and 255),
    target_date date not null,
    created_at timestamptz not null default now()
);

create index countdowns_target_date_idx on public.countdowns (target_date);

-- ---------------------------------------------------------------------
-- جدول إعدادات التطبيق: صف واحد فقط يحمل hash رمز الدخول
-- id من نوع boolean مع check (id) يضمن استحالة وجود أكثر من صف
-- ---------------------------------------------------------------------
create table public.app_settings (
    id boolean primary key default true check (id),
    pin_hash text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- =====================================================================
-- الأمان:
--  - app_settings محجوب تماماً عن الواجهة (لا يُقرأ الـ hash أبداً من المتصفح)
--  - التحقق من الـ PIN يتم حصرياً عبر دوال RPC تعمل بصلاحية المالك
--  - جداول البيانات مفتوحة للمفتاح العام (تطبيق شخصي أحادي المستخدم —
--    الحماية الفعلية هي عدم مشاركة الرابط والمفاتيح)
-- =====================================================================

alter table public.tasks enable row level security;
alter table public.entries enable row level security;
alter table public.countdowns enable row level security;
alter table public.app_settings enable row level security;

-- سياسات مفتوحة لجداول البيانات الثلاثة
create policy "anon full access" on public.tasks
  for all to anon using (true) with check (true);
create policy "anon full access" on public.entries
  for all to anon using (true) with check (true);
create policy "anon full access" on public.countdowns
  for all to anon using (true) with check (true);

-- app_settings: RLS مفعّل بدون أي سياسة + سحب الصلاحيات = محجوب كلياً
revoke all on public.app_settings from anon, authenticated;

-- ---------------------------------------------------------------------
-- دوال إدارة رمز الدخول (RPC)
-- security definer: تعمل بصلاحية مالك القاعدة فتتجاوز الحجب أعلاه،
-- لكنها لا تكشف الـ hash — تعيد true/false فقط
-- ---------------------------------------------------------------------

-- هل تم إعداد رمز دخول؟ (تحدد شاشة "الإعداد الأول" من شاشة "الدخول")
create or replace function public.has_pin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from app_settings where id = true);
$$;

-- إعداد الرمز لأول مرة — يفشل إن كان هناك رمز موجود (لا يسمح بالاستبدال)
create or replace function public.setup_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pin !~ '^\d{4,6}$' then
    return false;
  end if;
  if exists (select 1 from app_settings where id = true) then
    return false;
  end if;
  insert into app_settings (id, pin_hash) values (true, crypt(p_pin, gen_salt('bf')));
  return true;
end;
$$;

-- التحقق من الرمز. عند الخطأ ننتظر 300ms كإبطاء بسيط ضد التخمين
create or replace function public.verify_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
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

-- تغيير الرمز: يتطلب الرمز القديم الصحيح
create or replace function public.change_pin(p_old_pin text, p_new_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  h text;
begin
  if p_new_pin !~ '^\d{4,6}$' then
    return false;
  end if;
  select pin_hash into h from app_settings where id = true;
  if h is null or crypt(p_old_pin, h) <> h then
    perform pg_sleep(0.3);
    return false;
  end if;
  update app_settings set pin_hash = crypt(p_new_pin, gen_salt('bf')) where id = true;
  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- تفعيل التزامن اللحظي (Realtime) لجداول البيانات —
-- سيُستخدم لاحقاً ليعكس أي تعديل من جهاز على باقي الأجهزة فوراً
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.entries;
alter publication supabase_realtime add table public.countdowns;
