-- Suchabos and Merkliste alerts (Edge Function `alerts`) every 30 minutes.
-- The function is idempotent — it records what it mailed — so the public
-- publishable key is all the call needs (the same key ships in the site).
create extension if not exists pg_cron;

select cron.schedule(
  'ev4u-alerts',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://ovvxqtdqevzborasrpyu.supabase.co/functions/v1/alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_tXVCGVpanBPJ-YLzxLDvKA_gFxJAC3P',
      'Authorization', 'Bearer sb_publishable_tXVCGVpanBPJ-YLzxLDvKA_gFxJAC3P'
    ),
    body := '{}'::jsonb
  );
  $$
);
