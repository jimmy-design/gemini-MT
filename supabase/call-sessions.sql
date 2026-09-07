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

alter table public.call_sessions enable row level security;
alter table public.call_participants enable row level security;
alter table public.call_signals enable row level security;

drop policy if exists "members read call sessions" on public.call_sessions;
drop policy if exists "members create call sessions" on public.call_sessions;
drop policy if exists "members update call sessions" on public.call_sessions;
drop policy if exists "members read call participants" on public.call_participants;
drop policy if exists "members insert own call participant" on public.call_participants;
drop policy if exists "members update own call participant" on public.call_participants;
drop policy if exists "members read call signals" on public.call_signals;
drop policy if exists "members insert own call signals" on public.call_signals;
drop policy if exists "signed users insert calls" on public.calls;

create policy "members read call sessions"
on public.call_sessions
for select
using (
  exists (
    select 1
    from public.conversation_members member
    join public.profiles profile on profile.id = member.profile_id
    where member.conversation_id = call_sessions.conversation_id
      and profile.auth_user_id = auth.uid()
  )
);

create policy "members create call sessions"
on public.call_sessions
for insert
with check (
  exists (
    select 1
    from public.conversation_members member
    join public.profiles profile on profile.id = member.profile_id
    where member.conversation_id = call_sessions.conversation_id
      and profile.id = call_sessions.started_by_profile_id
      and profile.auth_user_id = auth.uid()
  )
);

create policy "members update call sessions"
on public.call_sessions
for update
using (
  exists (
    select 1
    from public.conversation_members member
    join public.profiles profile on profile.id = member.profile_id
    where member.conversation_id = call_sessions.conversation_id
      and profile.auth_user_id = auth.uid()
  )
);

create policy "members read call participants"
on public.call_participants
for select
using (
  exists (
    select 1
    from public.call_sessions session
    join public.conversation_members member on member.conversation_id = session.conversation_id
    join public.profiles profile on profile.id = member.profile_id
    where session.id = call_participants.call_session_id
      and profile.auth_user_id = auth.uid()
  )
);

create policy "members insert own call participant"
on public.call_participants
for insert
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = call_participants.profile_id
      and profiles.auth_user_id = auth.uid()
  )
);

create policy "members update own call participant"
on public.call_participants
for update
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = call_participants.profile_id
      and profiles.auth_user_id = auth.uid()
  )
);

create policy "members read call signals"
on public.call_signals
for select
using (
  exists (
    select 1
    from public.call_sessions session
    join public.conversation_members member on member.conversation_id = session.conversation_id
    join public.profiles profile on profile.id = member.profile_id
    where session.id = call_signals.call_session_id
      and profile.auth_user_id = auth.uid()
  )
);

create policy "members insert own call signals"
on public.call_signals
for insert
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = call_signals.sender_profile_id
      and profiles.auth_user_id = auth.uid()
  )
);

create policy "signed users insert calls"
on public.calls
for insert
with check (auth.uid() is not null);

do $$
begin
  alter publication supabase_realtime add table public.call_sessions;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.call_participants;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.call_signals;
exception
  when duplicate_object then null;
end $$;
