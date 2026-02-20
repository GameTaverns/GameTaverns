-- Catalog gallery backfill cron job
-- Fetches up to 5 gallery images per game from BGG for catalog entries missing additional_images
-- Processes 50 entries per invocation (~300ms delay per game = ~15s per batch)
-- Runs every minute to continuously backfill alongside the scraper

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
    body := '{"batchSize": 50}'::jsonb
  ) AS request_id;
  $$
);
