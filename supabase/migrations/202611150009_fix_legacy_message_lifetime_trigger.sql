-- The legacy trigger was setting a seven-day expiry, violating the 24-hour message policy.
create or replace function public.whisper_set_message_lifetime()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  new.created_at := now();
  new.expires_at := now() + interval '24 hours';
  return new;
end;
$function$;
