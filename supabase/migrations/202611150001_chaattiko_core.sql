-- Chaattiko core schema for the existing Whisper Supabase project.
-- Existing project/repository names are intentionally unchanged.
create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists original_name text,
  add column if not exists is_banned boolean not null default false,
  add column if not exists last_seen_at timestamptz,
  add column if not exists accepted_terms_at timestamptz;

alter table public.messages
  add column if not exists conversation_id uuid,
  add column if not exists message_type text not null default 'text';
alter table public.messages alter column expires_at set default (now() + interval '24 hours');

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind = 'direct'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id,user_id)
);
do $ begin
  alter table public.messages add constraint messages_conversation_id_fkey
    foreign key (conversation_id) references public.conversations(id) on delete cascade;
exception when duplicate_object then null; end $;

create table if not exists public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id,blocked_id),
  check (blocker_id <> blocked_id)
);
create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  other_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id,other_user_id),
  check (user_id <> other_user_id)
);
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create table if not exists public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_expiry_idx on public.messages(expires_at);
create index if not exists messages_conversation_time_idx on public.messages(conversation_id,created_at desc);
create index if not exists conversation_members_user_idx on public.conversation_members(user_id);

alter table public.profiles enable row level security;
alter table public.messages enable row level security;
alter table public.reactions enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.blocks enable row level security;
alter table public.favorites enable row level security;
alter table public.feedback enable row level security;
alter table public.admin_audit enable row level security;

-- Remove old/duplicate policies before installing this access model.
do $
declare p record;
begin
  for p in select schemaname,tablename,policyname from pg_policies
    where schemaname='public' and tablename in
      ('profiles','messages','reactions','conversations','conversation_members','blocks','favorites','feedback','admin_audit')
  loop
    execute format('drop policy if exists %I on %I.%I',p.policyname,p.schemaname,p.tablename);
  end loop;
end $;

-- Policies are intentionally narrow. Disable anonymous sign-ins in Supabase Auth settings.
create policy "Chaattiko profiles readable" on public.profiles for select to authenticated using (true);
create policy "Chaattiko profile insert own" on public.profiles for insert to authenticated with check (id=(select auth.uid()));
create policy "Chaattiko profile update own" on public.profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));

create policy "Chaattiko read visible messages" on public.messages for select to authenticated using (
 expires_at > now() and (conversation_id is null or exists (
  select 1 from public.conversation_members cm where cm.conversation_id=messages.conversation_id and cm.user_id=(select auth.uid())
 ))
);
create policy "Chaattiko insert own messages" on public.messages for insert to authenticated with check (
 user_id=(select auth.uid()) and expires_at <= created_at + interval '24 hours'
 and (conversation_id is null or exists (
  select 1 from public.conversation_members cm where cm.conversation_id=messages.conversation_id and cm.user_id=(select auth.uid())
 ))
);
create policy "Chaattiko delete own messages" on public.messages for delete to authenticated using (user_id=(select auth.uid()));

create policy "Chaattiko read visible reactions" on public.reactions for select to authenticated using (
 exists (select 1 from public.messages m where m.id=reactions.message_id and m.expires_at>now()
 and (m.conversation_id is null or exists (
  select 1 from public.conversation_members cm where cm.conversation_id=m.conversation_id and cm.user_id=(select auth.uid())
 )))
);
create policy "Chaattiko add own reactions" on public.reactions for insert to authenticated with check (user_id=(select auth.uid()));
create policy "Chaattiko remove own reactions" on public.reactions for delete to authenticated using (user_id=(select auth.uid()));

create policy "Chaattiko read member conversations" on public.conversations for select to authenticated using (
 exists(select 1 from public.conversation_members cm where cm.conversation_id=id and cm.user_id=(select auth.uid()))
);
create policy "Chaattiko create conversations" on public.conversations for insert to authenticated with check (created_by=(select auth.uid()));
create policy "Chaattiko read conversation membership" on public.conversation_members for select to authenticated using (
 user_id=(select auth.uid()) or exists(select 1 from public.conversation_members cm where cm.conversation_id=conversation_members.conversation_id and cm.user_id=(select auth.uid()))
);
create policy "Chaattiko creator adds members" on public.conversation_members for insert to authenticated with check (
 exists(select 1 from public.conversations c where c.id=conversation_id and c.created_by=(select auth.uid()))
);

create policy "Chaattiko read own blocks" on public.blocks for select to authenticated using (blocker_id=(select auth.uid()) or blocked_id=(select auth.uid()));
create policy "Chaattiko create own blocks" on public.blocks for insert to authenticated with check (blocker_id=(select auth.uid()));
create policy "Chaattiko blocker unblocks" on public.blocks for delete to authenticated using (blocker_id=(select auth.uid()));

create policy "Chaattiko read own favorites" on public.favorites for select to authenticated using (user_id=(select auth.uid()));
create policy "Chaattiko manage own favorites" on public.favorites for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy "Chaattiko submit feedback" on public.feedback for insert to authenticated with check (user_id=(select auth.uid()));
create policy "Chaattiko read own feedback" on public.feedback for select to authenticated using (user_id=(select auth.uid()));

revoke all on public.admin_audit from anon,authenticated;
grant select,insert,update on public.profiles to authenticated;
grant select,insert,delete on public.messages to authenticated;
grant select,insert,delete on public.reactions to authenticated;
grant select,insert on public.conversations to authenticated;
grant select,insert on public.conversation_members to authenticated;
grant select,insert,delete on public.blocks to authenticated;
grant select,insert,delete on public.favorites to authenticated;
grant select,insert on public.feedback to authenticated;

-- Invoker-security RPC: normal RLS remains in force for both participants.
create or replace function public.start_direct_conversation(other_user uuid)
returns uuid language plpgsql security invoker set search_path=public,auth as $$
declare me uuid := auth.uid(); existing_id uuid; new_id uuid;
begin
 if me is null or other_user is null or me=other_user then raise exception 'Invalid conversation participants'; end if;
 if exists(select 1 from public.blocks where (blocker_id=me and blocked_id=other_user) or (blocker_id=other_user and blocked_id=me)) then raise exception 'This conversation is blocked'; end if;
 select c.id into existing_id from public.conversations c
 join public.conversation_members a on a.conversation_id=c.id and a.user_id=me
 join public.conversation_members b on b.conversation_id=c.id and b.user_id=other_user
 where c.kind='direct' limit 1;
 if existing_id is not null then return existing_id; end if;
 insert into public.conversations(kind,created_by) values('direct',me) returning id into new_id;
 insert into public.conversation_members(conversation_id,user_id) values(new_id,me),(new_id,other_user);
 return new_id;
end; $$;
revoke all on function public.start_direct_conversation(uuid) from public,anon;
grant execute on function public.start_direct_conversation(uuid) to authenticated;

do $$ begin
 alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- Avoid recursive RLS evaluation when checking membership in conversation_members.
create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;
create or replace function private.is_conversation_member(target_conversation uuid)
returns boolean language sql stable security definer set search_path=public,auth as $$
  select auth.uid() is not null and exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id=target_conversation and cm.user_id=auth.uid()
  );
$$;
revoke all on function private.is_conversation_member(uuid) from public,anon;
grant execute on function private.is_conversation_member(uuid) to authenticated;

drop policy if exists "Chaattiko read member conversations" on public.conversations;
drop policy if exists "Chaattiko read conversation membership" on public.conversation_members;
drop policy if exists "Chaattiko read visible messages" on public.messages;
create policy "Chaattiko read member conversations" on public.conversations
for select to authenticated using (private.is_conversation_member(id));
create policy "Chaattiko read conversation membership" on public.conversation_members
for select to authenticated using (user_id=(select auth.uid()) or private.is_conversation_member(conversation_id));
create policy "Chaattiko read visible messages" on public.messages
for select to authenticated using (expires_at>now() and (conversation_id is null or private.is_conversation_member(conversation_id)));
