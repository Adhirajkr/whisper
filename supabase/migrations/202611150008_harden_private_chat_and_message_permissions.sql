-- Harden direct conversations: only the vetted RPC can create conversations or members.
create or replace function public.start_direct_conversation(other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  me uuid := auth.uid();
  existing_id uuid;
  new_id uuid;
begin
  if me is null or other_user is null or me = other_user then
    raise exception 'Invalid conversation participants';
  end if;
  if exists (
    select 1 from public.profiles p
    where p.id in (me, other_user) and p.is_banned = true
  ) then
    raise exception 'A participant account is unavailable';
  end if;
  if exists (
    select 1 from public.blocks
    where (blocker_id = me and blocked_id = other_user)
       or (blocker_id = other_user and blocked_id = me)
  ) then
    raise exception 'This conversation is blocked';
  end if;
  select c.id into existing_id
  from public.conversations c
  join public.conversation_members a on a.conversation_id = c.id and a.user_id = me
  join public.conversation_members b on b.conversation_id = c.id and b.user_id = other_user
  where c.kind = 'direct'
  limit 1;
  if existing_id is not null then return existing_id; end if;
  insert into public.conversations(kind, created_by)
  values ('direct', me) returning id into new_id;
  insert into public.conversation_members(conversation_id, user_id)
  values (new_id, me), (new_id, other_user);
  return new_id;
end;
$function$;

revoke all on function public.start_direct_conversation(uuid) from public, anon;
grant execute on function public.start_direct_conversation(uuid) to authenticated;

revoke all privileges on table public.conversations, public.conversation_members from anon, authenticated;
grant select on table public.conversations, public.conversation_members to authenticated;
-- SECURITY DEFINER RPC above is the only route for adding direct-chat participants.

-- Users may only create messages as their own profile and cannot set system-managed fields.
drop policy if exists "send public or member messages" on public.messages;
create policy "send public or member messages"
on public.messages for insert to authenticated
with check (
  user_id = auth.uid()
  and username = (select p.username from public.profiles p where p.id = auth.uid())
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_banned = false)
  and expires_at <= created_at + interval '24 hours'
  and (conversation_id is null or exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid()
  ))
  and not exists (
    select 1 from public.blocks b
    where b.blocker_id <> auth.uid()
      and b.blocked_id = auth.uid()
      and exists (
        select 1 from public.conversation_members cm
        where cm.conversation_id = messages.conversation_id and cm.user_id = b.blocker_id
      )
  )
);

revoke all privileges on table public.messages from anon, authenticated;
grant select, delete on table public.messages to authenticated;
grant insert (user_id, username, body, reply_to, conversation_id)
  on table public.messages to authenticated;

-- Reactions can be read on visible messages, created by their owner, and updated/deleted by their owner.
revoke all privileges on table public.reactions from anon, authenticated;
grant select, delete on table public.reactions to authenticated;
grant insert (message_id, user_id, emoji) on table public.reactions to authenticated;
grant update (emoji) on table public.reactions to authenticated;
