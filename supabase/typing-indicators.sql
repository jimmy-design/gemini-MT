create table if not exists public.typing_indicators (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  is_typing boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

alter table public.typing_indicators enable row level security;

drop policy if exists "members read typing indicators" on public.typing_indicators;
drop policy if exists "members insert own typing indicators" on public.typing_indicators;
drop policy if exists "members update own typing indicators" on public.typing_indicators;

create policy "members read typing indicators"
on public.typing_indicators
for select
using (
  exists (
    select 1
    from public.conversation_members own_member
    join public.profiles own_profile on own_profile.id = own_member.profile_id
    where own_member.conversation_id = typing_indicators.conversation_id
      and own_profile.auth_user_id = auth.uid()
  )
);

create policy "members insert own typing indicators"
on public.typing_indicators
for insert
with check (
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

create policy "members update own typing indicators"
on public.typing_indicators
for update
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = typing_indicators.profile_id
      and profiles.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = typing_indicators.profile_id
      and profiles.auth_user_id = auth.uid()
  )
);

do $$
begin
  alter publication supabase_realtime add table public.typing_indicators;
exception
  when duplicate_object then null;
end $$;
