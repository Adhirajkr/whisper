-- Whisper production baseline: align database rules with the seven-day public room.
-- Existing rows are preserved. Expired rows become invisible; physical cleanup can be
-- added later with a scheduled database job once the hosting plan is confirmed.

alter table public.messages
  alter column expires_at set default (now() + interval '7 days');

create or replace function public.whisper_set_message_lifetime()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.created_at := now();
  new.expires_at := now() + interval '7 days';
  return new;
end;
$$;

drop trigger if exists whisper_message_lifetime on public.messages;
create trigger whisper_message_lifetime
before insert on public.messages
for each row execute function public.whisper_set_message_lifetime();

-- Remove the old tautological profile check and require the sender's own profile.
drop policy if exists "Users send as themselves" on public.messages;
drop policy if exists "Users send as their own profile" on public.messages;
create policy "Users send as their own profile"
on public.messages
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.username = messages.username
  )
);

-- Keep public-room reads limited to messages that have not expired.
drop policy if exists "Signed-in users read unexpired messages" on public.messages;
create policy "Signed-in users read unexpired messages"
on public.messages
for select
to authenticated
using (expires_at > now());

-- Profiles are public display names only; each visitor may create/update their own.
drop policy if exists "Profiles readable by signed-in users" on public.profiles;
create policy "Profiles readable by signed-in users"
on public.profiles
for select
to authenticated
using (true);

-- Ensure the room stream is available to Supabase Realtime.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
exception when undefined_object then
  raise notice 'supabase_realtime publication is not available; enable it in Supabase later.';
end;
$$;
