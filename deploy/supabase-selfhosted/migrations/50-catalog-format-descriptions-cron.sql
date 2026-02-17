-- Catalog format descriptions cron job
-- Processes 150 games per invocation (3 workers × 50 items/batch)
-- Runs every minute to keep pace with scraper throughput (~144k/day)
-- At $0.005/request + token costs, batching 50 items amortizes the per-request fee

SELECT cron.schedule(
  'catalog-format-descriptions-cron',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'http://kong:8000/functions/v1/catalog-format-descriptions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"batchSize": 50, "workers": 3, "totalLimit": 150}'::jsonb
  ) AS request_id;
  $$
);
