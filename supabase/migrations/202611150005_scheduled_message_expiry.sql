create extension if not exists pg_cron with schema pg_catalog;
do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname='chaattiko-expire-messages' limit 1;
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
end $$;
select cron.schedule('chaattiko-expire-messages','* * * * *',
  $$delete from public.messages where expires_at <= now()$$
);
