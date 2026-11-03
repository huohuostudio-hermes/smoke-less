-- 熄火 App 云端设置表（Supabase SQL Editor 执行一次即可）
-- 手机改目标根数 → 写这里 → 电脑端长按动画读同一份
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
drop policy if exists "anon all" on public.settings;
create policy "anon all" on public.settings for all using (true) with check (true);
