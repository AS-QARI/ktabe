-- كتابي — خصائص شخصية خفيفة للمهام وسلة المحذوفات.
-- تاريخ المهمة مستقل عن الصفحة التي كُتبت فيها: يمكن تدوين مهمة اليوم
-- ثم جدولة تنفيذها للأسبوع المقبل من دون نقل النص أو فقدان سياقه.

alter table public.blocks
  add column if not exists due_date date,
  add column if not exists priority smallint not null default 0
    check (priority in (0, 1, 2, 3)),
  add column if not exists repeat_rule text not null default 'none'
    check (repeat_rule in ('none', 'daily', 'weekly', 'monthly')),
  add column if not exists reminder_at timestamptz,
  add column if not exists deleted_at timestamptz;

-- المهام القديمة تحتفظ بسلوكها السابق: تاريخ الصفحة هو موعدها الأولي.
update public.blocks b
set due_date = p.page_date
from public.pages p
where b.page_id = p.id
  and b.kind = 'task'
  and b.due_date is null;

create index if not exists blocks_open_due_idx
  on public.blocks (due_date, priority desc, position)
  where kind = 'task' and deleted_at is null;

create index if not exists blocks_trash_idx
  on public.blocks (deleted_at desc)
  where deleted_at is not null;
