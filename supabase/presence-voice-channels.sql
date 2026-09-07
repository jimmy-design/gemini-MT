create table if not exists public.profile_presence (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'online' check (status in ('online', 'away', 'offline')),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.messages add column if not exists media_url text;

create table if not exists public.channel_subscriptions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  notifications text not null default 'all' check (notifications in ('all', 'mentions', 'muted')),
  subscribed_at timestamptz not null default now()
);

create unique index if not exists channel_subscriptions_unique_profile
on public.channel_subscriptions(conversation_id, profile_id);

insert into storage.buckets (id, name, public)
values ('voice-notes', 'voice-notes', true)
on conflict (id) do update set public = true;

alter table public.profile_presence enable row level security;
alter table public.channel_subscriptions enable row level security;

drop policy if exists "public read profile presence" on public.profile_presence;
drop policy if exists "users upsert own presence" on public.profile_presence;
drop policy if exists "users update own presence" on public.profile_presence;
drop policy if exists "public read channel subscriptions" on public.channel_subscriptions;
drop policy if exists "users subscribe self to channels" on public.channel_subscriptions;
drop policy if exists "users update own channel subscriptions" on public.channel_subscriptions;
drop policy if exists "authenticated upload voice notes" on storage.objects;
drop policy if exists "public read voice notes" on storage.objects;

create policy "public read profile presence"
on public.profile_presence
for select
using (true);

create policy "users upsert own presence"
on public.profile_presence
for insert
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = profile_presence.profile_id
      and profiles.auth_user_id = auth.uid()
  )
);

create policy "users update own presence"
on public.profile_presence
for update
using (
  exists (
    select 1 from public.profiles
    where profiles.id = profile_presence.profile_id
      and profiles.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = profile_presence.profile_id
      and profiles.auth_user_id = auth.uid()
  )
);

create policy "public read channel subscriptions"
on public.channel_subscriptions
for select
using (true);

create policy "users subscribe self to channels"
on public.channel_subscriptions
for insert
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = channel_subscriptions.profile_id
      and profiles.auth_user_id = auth.uid()
  )
);

create policy "users update own channel subscriptions"
on public.channel_subscriptions
for update
using (
  exists (
    select 1 from public.profiles
    where profiles.id = channel_subscriptions.profile_id
      and profiles.auth_user_id = auth.uid()
  )
);

create policy "authenticated upload voice notes"
on storage.objects
for insert
with check (bucket_id = 'voice-notes' and auth.uid() is not null);

create policy "public read voice notes"
on storage.objects
for select
using (bucket_id = 'voice-notes');

do $$
begin
  alter publication supabase_realtime add table public.profile_presence;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.channel_subscriptions;
exception
  when duplicate_object then null;
end $$;
