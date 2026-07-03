-- كتابي — Migration 003: نموذج الدفتر (صفحات يومية + سطور)
-- الصفحة = ورقة ليوم محدد (ويمكن تعدد صفحات اليوم عبر page_no)
-- السطر (block) = نص حر أو مهمة، مع parent_id للفرعيات والتعليقات
-- (مطبق على القاعدة باسم day_pages_and_blocks — يشمل ترحيل بيانات
--  entries/tasks القديمة ثم حذف الجدولين)

create table public.pages (
    id uuid primary key default gen_random_uuid(),
    page_date date not null,
    page_no smallint not null default 1 check (page_no >= 1),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (page_date, page_no)
);

create index pages_date_idx on public.pages (page_date);

create trigger pages_set_updated_at
  before update on public.pages
  for each row execute function public.set_updated_at();

create table public.blocks (
    id uuid primary key default gen_random_uuid(),
    page_id uuid not null references public.pages(id) on delete cascade,
    parent_id uuid references public.blocks(id) on delete cascade,
    kind text not null default 'text' check (kind in ('text', 'task')),
    content text not null default '',
    is_completed boolean not null default false,
    completed_at timestamptz,
    position double precision not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index blocks_page_idx on public.blocks (page_id, position);
create index blocks_completed_idx on public.blocks (completed_at) where completed_at is not null;

create trigger blocks_set_updated_at
  before update on public.blocks
  for each row execute function public.set_updated_at();

alter table public.pages enable row level security;
alter table public.blocks enable row level security;

create policy "anon full access" on public.pages
  for all to anon using (true) with check (true);
create policy "anon full access" on public.blocks
  for all to anon using (true) with check (true);

alter publication supabase_realtime add table public.pages;
alter publication supabase_realtime add table public.blocks;

-- (في القاعدة الفعلية تلا ذلك ترحيل بيانات entries/tasks ثم:)
-- drop table public.entries;
-- drop table public.tasks;
