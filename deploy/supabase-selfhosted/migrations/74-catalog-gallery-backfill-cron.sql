-- Catalog gallery backfill cron job
-- Fetches up to 50 BGG gallery images per invocation for catalog entries missing additional_images
-- Runs every minute to continuously process the backlog

SELECT cron.unschedule('catalog-gallery-backfill-cron')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'catalog-gallery-backfill-cron');

SELECT cron.schedule(
  'catalog-gallery-backfill-cron',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'http://kong:8000/functions/v1/catalog-gallery-backfill',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"limit": 50}'::jsonb
  ) AS request_id;
  $$
);
