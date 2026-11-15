-- Prevent duplicate Chaattiko nicknames regardless of letter casing.
-- Existing profiles were checked for case-insensitive duplicates before applying.
create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username));
