-- Backfill year_published for catalog entries missing it
-- Runs every minute until all entries have year_published populated
-- Processes 200 entries per run (10 BGG API calls of 20 IDs each)
-- Safe to leave running — auto-skips when nothing remains

SELECT cron.unschedule('catalog-backfill-years-cron')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'catalog-backfill-years-cron');

SELECT cron.schedule(
  'catalog-backfill-years-cron',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'http://kong:8000/functions/v1/catalog-backfill',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"mode": "backfill-years", "batch_size": 200}'::jsonb
  ) AS request_id;
  $$
);
