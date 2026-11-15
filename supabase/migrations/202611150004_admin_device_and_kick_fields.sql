alter table public.profiles
  add column if not exists last_seen_ip text,
  add column if not exists last_seen_user_agent text,
  add column if not exists kick_requested_at timestamptz;
