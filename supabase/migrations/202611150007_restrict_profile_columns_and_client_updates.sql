-- Keep sensitive profile metadata server-side. RLS filters rows, while column grants restrict which fields authenticated users can read or change.
revoke all privileges on table public.profiles from anon, authenticated;
revoke all privileges (id, username, gender, created_at, original_name, is_banned, last_seen_at, accepted_terms_at, last_seen_ip, last_seen_user_agent, kick_requested_at)
  on table public.profiles from anon, authenticated;

grant select (id, username, gender, created_at, is_banned, last_seen_at)
  on table public.profiles to authenticated;
grant insert (id, username, original_name, gender, accepted_terms_at)
  on table public.profiles to authenticated;
-- Authenticated clients cannot change ban, kick, presence, or private metadata fields.
