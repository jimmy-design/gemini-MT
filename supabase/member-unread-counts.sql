alter table public.conversation_members
add column if not exists unread_count integer not null default 0;

drop policy if exists "users update own conversation members" on public.conversation_members;

create policy "users update own conversation members"
on public.conversation_members
for update
using (
  exists (
    select 1 from public.profiles
    where profiles.id = conversation_members.profile_id
      and profiles.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = conversation_members.profile_id
      and profiles.auth_user_id = auth.uid()
  )
);

create or replace function public.bump_unread_for_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversation_members
  set unread_count = unread_count + 1
  where conversation_id = new.conversation_id
    and (
      new.sender_profile_id is null
      or profile_id <> new.sender_profile_id
    );

  update public.conversations
  set
    preview = case
      when new.type = 'voice' then coalesce('Voice note - ' || new.duration, 'Voice note')
      when new.type = 'media' then coalesce(new.caption, new.body)
      else new.body
    end,
    last_message_at = new.created_at
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists messages_bump_unread on public.messages;
create trigger messages_bump_unread
after insert on public.messages
for each row
execute function public.bump_unread_for_message();

do $$
begin
  alter publication supabase_realtime add table public.conversation_members;
exception
  when duplicate_object then null;
end $$;
