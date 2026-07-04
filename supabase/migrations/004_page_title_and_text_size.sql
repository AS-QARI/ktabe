alter table public.pages
  add column if not exists title text not null default '',
  add column if not exists text_size text not null default 'md'
    check (text_size in ('sm', 'md', 'lg', 'xl'));
