-- Catalog designer & artist backfill cron job
-- Fetches BGG XML to populate designer/artist metadata for unenriched catalog entries
-- Uses mode "enrich" to target entries missing designers/artists via get_unenriched_catalog_entries
-- Processes 5 entries per invocation (~500ms BGG delay per batch)
-- Runs every minute to catch up with scraper throughput

SELECT cron.schedule(
  'catalog-designer-artist-backfill-cron',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'http://kong:8000/functions/v1/catalog-backfill',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"mode": "enrich", "batch_size": 5}'::jsonb
  ) AS request_id;
  $$
);

