create unique index if not exists profiles_phone_number_key
on public.profiles(phone_number)
where phone_number is not null;

alter table public.messages
add column if not exists sender_profile_id uuid references public.profiles(id) on delete set null;

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

alter table public.conversation_members enable row level security;
alter table public.user_contacts enable row level security;

drop policy if exists "signed users insert conversations" on public.conversations;
drop policy if exists "signed users update conversations" on public.conversations;
drop policy if exists "users read own conversation members" on public.conversation_members;
drop policy if exists "users insert own conversation members" on public.conversation_members;
drop policy if exists "users read own matched contacts" on public.user_contacts;
drop policy if exists "users insert own matched contacts" on public.user_contacts;
drop policy if exists "users update own matched contacts" on public.user_contacts;

create policy "signed users insert conversations"
on public.conversations
for insert
with check (auth.uid() is not null);

create policy "signed users update conversations"
on public.conversations
for update
using (auth.uid() is not null);

create policy "users read own conversation members"
on public.conversation_members
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = conversation_members.profile_id
    and profiles.auth_user_id = auth.uid()
  )
);

create policy "users insert own conversation members"
on public.conversation_members
for insert
with check (true);

create policy "users read own matched contacts"
on public.user_contacts
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = user_contacts.owner_profile_id
    and profiles.auth_user_id = auth.uid()
  )
);

create policy "users insert own matched contacts"
on public.user_contacts
for insert
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = user_contacts.owner_profile_id
    and profiles.auth_user_id = auth.uid()
  )
);

create policy "users update own matched contacts"
on public.user_contacts
for update
using (
  exists (
    select 1 from public.profiles
    where profiles.id = user_contacts.owner_profile_id
    and profiles.auth_user_id = auth.uid()
  )
);
