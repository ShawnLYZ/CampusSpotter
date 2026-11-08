-- Schedules for the six pipeline jobs (UTC). Re-push safe: each job is unscheduled first.

select cron.unschedule('sync-timetable') where exists (select 1 from cron.job where jobname = 'sync-timetable');
select cron.schedule('sync-timetable', '0 21 * * *', $$
  select net.http_post(
    url := 'https://bndctdmmcwnwiwxdtmcb.supabase.co/functions/v1/sync-timetable',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
$$);

select cron.unschedule('sync-traffic') where exists (select 1 from cron.job where jobname = 'sync-traffic');
select cron.schedule('sync-traffic', '30 21 * * *', $$
  select net.http_post(
    url := 'https://bndctdmmcwnwiwxdtmcb.supabase.co/functions/v1/sync-traffic',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
$$);

select cron.unschedule('event-scan') where exists (select 1 from cron.job where jobname = 'event-scan');
select cron.schedule('event-scan', '0 22 * * *', $$
  select net.http_post(
    url := 'https://bndctdmmcwnwiwxdtmcb.supabase.co/functions/v1/event-scan',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
$$);

select cron.unschedule('sync-weather') where exists (select 1 from cron.job where jobname = 'sync-weather');
select cron.schedule('sync-weather', '0 */3 * * *', $$
  select net.http_post(
    url := 'https://bndctdmmcwnwiwxdtmcb.supabase.co/functions/v1/sync-weather',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
$$);

select cron.unschedule('sync-prayer') where exists (select 1 from cron.job where jobname = 'sync-prayer');
select cron.schedule('sync-prayer', '0 20 * * 0', $$
  select net.http_post(
    url := 'https://bndctdmmcwnwiwxdtmcb.supabase.co/functions/v1/sync-prayer',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
$$);

select cron.unschedule('sync-ridership') where exists (select 1 from cron.job where jobname = 'sync-ridership');
select cron.schedule('sync-ridership', '30 15 * * *', $$
  select net.http_post(
    url := 'https://bndctdmmcwnwiwxdtmcb.supabase.co/functions/v1/sync-ridership',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
$$);
