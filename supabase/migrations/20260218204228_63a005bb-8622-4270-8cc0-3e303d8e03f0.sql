
-- Schedule catalog-format-descriptions cron on Lovable Cloud
-- Processes 150 games per invocation (3 workers × 50 items/batch)
-- Runs every minute to keep pace with scraper throughput

SELECT cron.unschedule('catalog-format-descriptions-cron')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'catalog-format-descriptions-cron');

SELECT cron.schedule(
  'catalog-format-descriptions-cron',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ddfslywzgddlpmkhohfu.supabase.co/functions/v1/catalog-format-descriptions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"batchSize": 50, "workers": 3, "totalLimit": 150}'::jsonb
  ) AS request_id;
  $$
);
