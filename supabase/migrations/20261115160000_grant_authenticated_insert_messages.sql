-- Allow signed-in users to submit messages and sticker messages.
-- Row-level security remains enabled and the existing INSERT policy still
-- enforces ownership, username, ban status, expiry, membership, and block rules.
grant insert on table public.messages to authenticated;
