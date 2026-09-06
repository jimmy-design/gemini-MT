create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  handle text not null unique,
  initials text not null,
  color text not null default 'mint',
  status text not null default 'offline',
  last_seen text not null default 'last seen recently',
  avatar_url text,
  phone_number text,
  country_name text,
  country_code text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;
alter table public.profiles add column if not exists name text not null default 'Wave User';
alter table public.profiles add column if not exists handle text not null default '';
alter table public.profiles add column if not exists initials text not null default 'WU';
alter table public.profiles add column if not exists color text not null default 'mint';
alter table public.profiles add column if not exists status text not null default 'offline';
alter table public.profiles add column if not exists last_seen text not null default 'last seen recently';
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists phone_number text;
alter table public.profiles add column if not exists country_name text;
alter table public.profiles add column if not exists country_code text;
alter table public.profiles add column if not exists verified boolean not null default false;
alter table public.profiles add column if not exists created_at timestamptz not null default now();

create unique index if not exists profiles_auth_user_id_key on public.profiles(auth_user_id) where auth_user_id is not null;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  handle text not null,
  initials text not null,
  color text not null default 'mint',
  type text not null default 'direct' check (type in ('direct', 'group', 'channel')),
  status text not null default 'offline',
  last_seen text not null default 'last seen recently',
  preview text not null default '',
  last_message_at timestamptz not null default now(),
  unread_count integer not null default 0,
  pinned boolean not null default false,
  muted boolean not null default false,
  verified boolean not null default false,
  labels text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender text not null default 'me' check (sender in ('me', 'them')),
  type text not null default 'text' check (type in ('text', 'media', 'voice', 'system')),
  body text not null,
  caption text,
  duration text,
  seen boolean not null default false,
  reactions text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.status_updates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default 'mint',
  seen boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  missed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  members integer not null default 0,
  groups integer not null default 0,
  created_at timestamptz not null default now()
);

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

create unique index if not exists user_settings_auth_user_id_key on public.user_settings(auth_user_id) where auth_user_id is not null;

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.status_updates enable row level security;
alter table public.calls enable row level security;
alter table public.communities enable row level security;
alter table public.marketplace_items enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "public read profiles" on public.profiles;
drop policy if exists "users insert own profile" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "public read conversations" on public.conversations;
drop policy if exists "public read messages" on public.messages;
drop policy if exists "public insert messages" on public.messages;
drop policy if exists "public read statuses" on public.status_updates;
drop policy if exists "public read calls" on public.calls;
drop policy if exists "public read communities" on public.communities;
drop policy if exists "public read marketplace items" on public.marketplace_items;
drop policy if exists "users read own settings" on public.user_settings;
drop policy if exists "users insert own settings" on public.user_settings;
drop policy if exists "users update own settings" on public.user_settings;

create policy "public read profiles" on public.profiles for select using (true);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = auth_user_id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = auth_user_id);
create policy "public read conversations" on public.conversations for select using (true);
create policy "public read messages" on public.messages for select using (true);
create policy "public insert messages" on public.messages for insert with check (true);
create policy "public read statuses" on public.status_updates for select using (true);
create policy "public read calls" on public.calls for select using (true);
create policy "public read communities" on public.communities for select using (true);
create policy "public read marketplace items" on public.marketplace_items for select using (true);
create policy "users read own settings" on public.user_settings for select using (auth.uid() = auth_user_id);
create policy "users insert own settings" on public.user_settings for insert with check (auth.uid() = auth_user_id);
create policy "users update own settings" on public.user_settings for update using (auth.uid() = auth_user_id);
