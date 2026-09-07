create table if not exists public.marketplace_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  meta text not null default '',
  icon text not null default 'spark',
  color text not null default 'mint',
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete cascade,
  screen_lock boolean not null default true,
  read_receipts boolean not null default true,
  live_location boolean not null default false,
  chat_lock boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings
drop constraint if exists user_settings_auth_user_id_unique;

alter table public.user_settings
add constraint user_settings_auth_user_id_unique unique (auth_user_id);

alter table public.marketplace_items enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "public read marketplace items" on public.marketplace_items;
drop policy if exists "users read own settings" on public.user_settings;
drop policy if exists "users insert own settings" on public.user_settings;
drop policy if exists "users update own settings" on public.user_settings;

create policy "public read marketplace items"
on public.marketplace_items
for select
using (true);

create policy "users read own settings"
on public.user_settings
for select
using (auth.uid() = auth_user_id);

create policy "users insert own settings"
on public.user_settings
for insert
with check (auth.uid() = auth_user_id);

create policy "users update own settings"
on public.user_settings
for update
using (auth.uid() = auth_user_id);
