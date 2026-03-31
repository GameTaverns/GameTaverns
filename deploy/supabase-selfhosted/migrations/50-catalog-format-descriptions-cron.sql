-- Catalog format descriptions cron job
-- Processes 3 games per invocation (1 worker × 3 items)
-- Runs every 30 minutes — gentle on Cortex, only targets unformatted entries

SELECT cron.unschedule('catalog-format-descriptions-cron')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'catalog-format-descriptions-cron');

SELECT cron.schedule(
  'catalog-format-descriptions-cron',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'http://kong:8000/functions/v1/catalog-format-descriptions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"batchSize": 3, "workers": 1, "totalLimit": 3}'::jsonb
  ) AS request_id;
  $$
);
