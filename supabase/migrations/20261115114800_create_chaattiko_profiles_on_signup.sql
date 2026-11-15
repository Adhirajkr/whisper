-- Keep Auth users and Chaattiko profiles in one database transaction.
-- If profile creation fails, the Auth signup fails too; no orphan Auth user remains.

create or replace function public.handle_new_chaattiko_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text;
  requested_gender text;
begin
  requested_username := lower(trim(coalesce(
    new.raw_user_meta_data ->> 'nickname',
    split_part(coalesce(new.email, ''), '@', 1)
  )));
  requested_gender := new.raw_user_meta_data ->> 'gender';

  if requested_username !~ '^[a-zA-Z0-9_]{3,20}$' then
    raise exception 'A valid Chaattiko nickname is required';
  end if;

  if requested_gender not in ('woman', 'man', 'non_binary', 'prefer_not_to_say') then
    requested_gender := null;
  end if;

  insert into public.profiles (
    id, username, original_name, gender, accepted_terms_at
  ) values (
    new.id,
    requested_username,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'original_name', '')), ''),
    requested_gender,
    now()
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_chaattiko on auth.users;
create trigger on_auth_user_created_chaattiko
  after insert on auth.users
  for each row execute function public.handle_new_chaattiko_user();
