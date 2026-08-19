-- كتابي — حالة المهمة: تفصيل ما بعد الإكمال/عدم الإكمال. is_completed
-- يبقى كما هو (يوافق status = 'done') حتى لا تنكسر الفلاتر والإحصاءات
-- القديمة التي تعتمد عليه؛ status هو مصدر الحقيقة للواجهة من الآن.

alter table public.blocks
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'done', 'postponed'));

update public.blocks
set status = case when is_completed then 'done' else 'pending' end
where kind = 'task';
