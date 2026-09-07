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

alter table public.profiles
drop constraint if exists profiles_auth_user_id_unique;

alter table public.profiles
add constraint profiles_auth_user_id_unique unique (auth_user_id);
create unique index if not exists profiles_phone_number_key on public.profiles(phone_number) where phone_number is not null;

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
  sender_profile_id uuid references public.profiles(id) on delete set null,
  sender text not null default 'me' check (sender in ('me', 'them')),
  type text not null default 'text' check (type in ('text', 'media', 'voice', 'system')),
  body text not null,
  caption text,
  duration text,
  media_url text,
  seen boolean not null default false,
  reactions text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.messages add column if not exists sender_profile_id uuid references public.profiles(id) on delete set null;
alter table public.messages add column if not exists media_url text;

create table if not exists public.profile_presence (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'online' check (status in ('online', 'away', 'offline')),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.typing_indicators (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  is_typing boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

create table if not exists public.conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin', 'owner')),
  joined_at timestamptz not null default now()
);

create unique index if not exists conversation_members_unique_profile
on public.conversation_members(conversation_id, profile_id);

create table if not exists public.user_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  contact_profile_id uuid not null references public.profiles(id) on delete cascade,
  device_name text,
  device_phone_number text not null,
  matched_at timestamptz not null default now()
);

create unique index if not exists user_contacts_unique_match
on public.user_contacts(owner_profile_id, contact_profile_id);

create table if not exists public.channel_subscriptions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  notifications text not null default 'all' check (notifications in ('all', 'mentions', 'muted')),
  subscribed_at timestamptz not null default now()
);

create unique index if not exists channel_subscriptions_unique_profile
on public.channel_subscriptions(conversation_id, profile_id);

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

create table if not exists public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  started_by_profile_id uuid references public.profiles(id) on delete set null,
  mode text not null default 'voice' check (mode in ('voice', 'video')),
  status text not null default 'ringing' check (status in ('ringing', 'active', 'ended', 'missed', 'declined')),
  started_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz
);

create table if not exists public.call_participants (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid not null references public.call_sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  muted boolean not null default false,
  camera_off boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz
);

create unique index if not exists call_participants_unique_profile
on public.call_participants(call_session_id, profile_id);

create table if not exists public.call_signals (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid not null references public.call_sessions(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  receiver_profile_id uuid references public.profiles(id) on delete cascade,
  type text not null check (type in ('offer', 'answer', 'ice', 'ringing', 'hangup')),
  payload jsonb not null default '{}'::jsonb,
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

alter table public.user_settings
drop constraint if exists user_settings_auth_user_id_unique;

alter table public.user_settings
add constraint user_settings_auth_user_id_unique unique (auth_user_id);

insert into storage.buckets (id, name, public)
values ('voice-notes', 'voice-notes', true)
on conflict (id) do update set public = true;

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.profile_presence enable row level security;
alter table public.typing_indicators enable row level security;
alter table public.conversation_members enable row level security;
alter table public.user_contacts enable row level security;
alter table public.channel_subscriptions enable row level security;
alter table public.status_updates enable row level security;
alter table public.calls enable row level security;
alter table public.call_sessions enable row level security;
alter table public.call_participants enable row level security;
alter table public.call_signals enable row level security;
alter table public.communities enable row level security;
alter table public.marketplace_items enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "public read profiles" on public.profiles;
drop policy if exists "users insert own profile" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "public read conversations" on public.conversations;
drop policy if exists "signed users insert conversations" on public.conversations;
drop policy if exists "signed users update conversations" on public.conversations;
drop policy if exists "public read messages" on public.messages;
drop policy if exists "public insert messages" on public.messages;
drop policy if exists "public read profile presence" on public.profile_presence;
drop policy if exists "users upsert own presence" on public.profile_presence;
drop policy if exists "users update own presence" on public.profile_presence;
drop policy if exists "members read typing indicators" on public.typing_indicators;
drop policy if exists "members insert own typing indicators" on public.typing_indicators;
drop policy if exists "members update own typing indicators" on public.typing_indicators;
drop policy if exists "users read own conversation members" on public.conversation_members;
drop policy if exists "users insert own conversation members" on public.conversation_members;
drop policy if exists "users read own matched contacts" on public.user_contacts;
drop policy if exists "users insert own matched contacts" on public.user_contacts;
drop policy if exists "users update own matched contacts" on public.user_contacts;
drop policy if exists "public read channel subscriptions" on public.channel_subscriptions;
drop policy if exists "users subscribe self to channels" on public.channel_subscriptions;
drop policy if exists "users update own channel subscriptions" on public.channel_subscriptions;
drop policy if exists "public read statuses" on public.status_updates;
drop policy if exists "public read calls" on public.calls;
drop policy if exists "signed users insert calls" on public.calls;
drop policy if exists "members read call sessions" on public.call_sessions;
drop policy if exists "members create call sessions" on public.call_sessions;
drop policy if exists "members update call sessions" on public.call_sessions;
drop policy if exists "members read call participants" on public.call_participants;
drop policy if exists "members insert own call participant" on public.call_participants;
drop policy if exists "members update own call participant" on public.call_participants;
drop policy if exists "members read call signals" on public.call_signals;
drop policy if exists "members insert own call signals" on public.call_signals;
drop policy if exists "public read communities" on public.communities;
drop policy if exists "public read marketplace items" on public.marketplace_items;
drop policy if exists "users read own settings" on public.user_settings;
drop policy if exists "users insert own settings" on public.user_settings;
drop policy if exists "users update own settings" on public.user_settings;
drop policy if exists "authenticated upload voice notes" on storage.objects;
drop policy if exists "public read voice notes" on storage.objects;

create policy "public read profiles" on public.profiles for select using (true);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = auth_user_id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = auth_user_id);
create policy "public read conversations" on public.conversations for select using (true);
create policy "signed users insert conversations" on public.conversations for insert with check (auth.uid() is not null);
create policy "signed users update conversations" on public.conversations for update using (auth.uid() is not null);
create policy "public read messages" on public.messages for select using (true);
create policy "public insert messages" on public.messages for insert with check (true);
create policy "public read profile presence" on public.profile_presence for select using (true);
create policy "users upsert own presence" on public.profile_presence for insert with check (
  exists (
    select 1 from public.profiles
    where profiles.id = profile_presence.profile_id
      and profiles.auth_user_id = auth.uid()
  )
);
create policy "users update own presence" on public.profile_presence for update using (
  exists (
    select 1 from public.profiles
    where profiles.id = profile_presence.profile_id
      and profiles.auth_user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.profiles
    where profiles.id = profile_presence.profile_id
      and profiles.auth_user_id = auth.uid()
  )
);
create policy "members read typing indicators" on public.typing_indicators for select using (
  exists (
    select 1
    from public.conversation_members own_member
    join public.profiles own_profile on own_profile.id = own_member.profile_id
    where own_member.conversation_id = typing_indicators.conversation_id
      and own_profile.auth_user_id = auth.uid()
  )
);
create policy "members insert own typing indicators" on public.typing_indicators for insert with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = typing_indicators.profile_id
      and profiles.auth_user_id = auth.uid()
  )
  and exists (
    select 1
    from public.conversation_members
    where conversation_members.conversation_id = typing_indicators.conversation_id
      and conversation_members.profile_id = typing_indicators.profile_id
  )
);
create policy "members update own typing indicators" on public.typing_indicators for update using (
  exists (
    select 1
    from public.profiles
    where profiles.id = typing_indicators.profile_id
      and profiles.auth_user_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = typing_indicators.profile_id
      and profiles.auth_user_id = auth.uid()
  )
);
create policy "users read own conversation members" on public.conversation_members for select using (
  exists (
    select 1 from public.profiles
    where profiles.id = conversation_members.profile_id
    and profiles.auth_user_id = auth.uid()
  )
);
create policy "users insert own conversation members" on public.conversation_members for insert with check (true);
create policy "users read own matched contacts" on public.user_contacts for select using (
  exists (
    select 1 from public.profiles
    where profiles.id = user_contacts.owner_profile_id
    and profiles.auth_user_id = auth.uid()
  )
);
create policy "users insert own matched contacts" on public.user_contacts for insert with check (
  exists (
    select 1 from public.profiles
    where profiles.id = user_contacts.owner_profile_id
    and profiles.auth_user_id = auth.uid()
  )
);
create policy "users update own matched contacts" on public.user_contacts for update using (
  exists (
    select 1 from public.profiles
    where profiles.id = user_contacts.owner_profile_id
    and profiles.auth_user_id = auth.uid()
  )
);
create policy "public read channel subscriptions" on public.channel_subscriptions for select using (true);
create policy "users subscribe self to channels" on public.channel_subscriptions for insert with check (
  exists (
    select 1 from public.profiles
    where profiles.id = channel_subscriptions.profile_id
      and profiles.auth_user_id = auth.uid()
  )
);
create policy "users update own channel subscriptions" on public.channel_subscriptions for update using (
  exists (
    select 1 from public.profiles
    where profiles.id = channel_subscriptions.profile_id
      and profiles.auth_user_id = auth.uid()
  )
);
create policy "public read statuses" on public.status_updates for select using (true);
create policy "public read calls" on public.calls for select using (true);
create policy "signed users insert calls" on public.calls for insert with check (auth.uid() is not null);
create policy "members read call sessions" on public.call_sessions for select using (
  exists (
    select 1
    from public.conversation_members member
    join public.profiles profile on profile.id = member.profile_id
    where member.conversation_id = call_sessions.conversation_id
      and profile.auth_user_id = auth.uid()
  )
);
create policy "members create call sessions" on public.call_sessions for insert with check (
  exists (
    select 1
    from public.conversation_members member
    join public.profiles profile on profile.id = member.profile_id
    where member.conversation_id = call_sessions.conversation_id
      and profile.id = call_sessions.started_by_profile_id
      and profile.auth_user_id = auth.uid()
  )
);
create policy "members update call sessions" on public.call_sessions for update using (
  exists (
    select 1
    from public.conversation_members member
    join public.profiles profile on profile.id = member.profile_id
    where member.conversation_id = call_sessions.conversation_id
      and profile.auth_user_id = auth.uid()
  )
);
create policy "members read call participants" on public.call_participants for select using (
  exists (
    select 1
    from public.call_sessions session
    join public.conversation_members member on member.conversation_id = session.conversation_id
    join public.profiles profile on profile.id = member.profile_id
    where session.id = call_participants.call_session_id
      and profile.auth_user_id = auth.uid()
  )
);
create policy "members insert own call participant" on public.call_participants for insert with check (
  exists (
    select 1 from public.profiles
    where profiles.id = call_participants.profile_id
      and profiles.auth_user_id = auth.uid()
  )
);
create policy "members update own call participant" on public.call_participants for update using (
  exists (
    select 1 from public.profiles
    where profiles.id = call_participants.profile_id
      and profiles.auth_user_id = auth.uid()
  )
);
create policy "members read call signals" on public.call_signals for select using (
  exists (
    select 1
    from public.call_sessions session
    join public.conversation_members member on member.conversation_id = session.conversation_id
    join public.profiles profile on profile.id = member.profile_id
    where session.id = call_signals.call_session_id
      and profile.auth_user_id = auth.uid()
  )
);
create policy "members insert own call signals" on public.call_signals for insert with check (
  exists (
    select 1 from public.profiles
    where profiles.id = call_signals.sender_profile_id
      and profiles.auth_user_id = auth.uid()
  )
);
create policy "public read communities" on public.communities for select using (true);
create policy "public read marketplace items" on public.marketplace_items for select using (true);
create policy "users read own settings" on public.user_settings for select using (auth.uid() = auth_user_id);
create policy "users insert own settings" on public.user_settings for insert with check (auth.uid() = auth_user_id);
create policy "users update own settings" on public.user_settings for update using (auth.uid() = auth_user_id);
create policy "authenticated upload voice notes" on storage.objects for insert with check (bucket_id = 'voice-notes' and auth.uid() is not null);
create policy "public read voice notes" on storage.objects for select using (bucket_id = 'voice-notes');
