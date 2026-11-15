-- Authenticated users need SQL privileges in addition to the existing RLS policies.
-- RLS continues to control which profile rows each user may access.
grant select, insert, update on table public.profiles to authenticated;
