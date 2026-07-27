-- تثبيت الملاحظات: يرافق الصفحة كي يتزامن بين الأجهزة.
alter table public.pages
  add column if not exists is_pinned boolean not null default false,
  add column if not exists pinned_at timestamptz;

create index if not exists pages_pinned_at_idx
  on public.pages (is_pinned, pinned_at desc)
  where is_pinned = true;
