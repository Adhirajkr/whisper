-- Allow PostgREST upsert to use INSERT ... ON CONFLICT DO UPDATE.
-- RLS still limits inserts and updates to the signed-in user's own reaction on a visible message.
grant insert, update on table public.reactions to authenticated;

drop policy if exists "add own reactions" on public.reactions;
create policy "add own reactions"
on public.reactions for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.messages m
    where m.id = reactions.message_id
      and m.expires_at > now()
      and (m.conversation_id is null or exists (
        select 1 from public.conversation_members cm
        where cm.conversation_id = m.conversation_id
          and cm.user_id = auth.uid()
      ))
  )
);

drop policy if exists "users update own reactions" on public.reactions;
create policy "users update own reactions"
on public.reactions for update to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.messages m
    where m.id = reactions.message_id
      and m.expires_at > now()
      and (m.conversation_id is null or exists (
        select 1 from public.conversation_members cm
        where cm.conversation_id = m.conversation_id
          and cm.user_id = auth.uid()
      ))
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.messages m
    where m.id = reactions.message_id
      and m.expires_at > now()
      and (m.conversation_id is null or exists (
        select 1 from public.conversation_members cm
        where cm.conversation_id = m.conversation_id
          and cm.user_id = auth.uid()
      ))
  )
);
