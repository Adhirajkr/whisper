-- Upserted reactions require an UPDATE policy in addition to INSERT.
drop policy if exists "users update own reactions" on public.reactions;
create policy "users update own reactions"
on public.reactions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
