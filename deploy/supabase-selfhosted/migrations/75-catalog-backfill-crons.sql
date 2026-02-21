-- Catalog backfill cron jobs
-- 1) Type-check: tags unenriched entries with bgg_verified_type every minute (batch of 200)
-- 2) Enrichment: backfills designers/mechanics/weight every 2 minutes (batch of 20)

-- Type-check cron (fast, lightweight — just fetches item type from BGG)
SELECT cron.unschedule('catalog-type-check-cron')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'catalog-type-check-cron');

SELECT cron.schedule(
  'catalog-type-check-cron',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'http://kong:8000/functions/v1/catalog-backfill',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"mode": "type-check", "batch_size": 200}'::jsonb
  ) AS request_id;
  $$
);

-- Enrichment cron (heavier — fetches full metadata from BGG)
SELECT cron.unschedule('catalog-enrichment-cron')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'catalog-enrichment-cron');

SELECT cron.schedule(
  'catalog-enrichment-cron',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'http://kong:8000/functions/v1/catalog-backfill',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"batch_size": 20}'::jsonb
  ) AS request_id;
  $$
);

-- Auto-cleanup cron: delete non-boardgame entries daily at 3:30 AM
SELECT cron.unschedule('catalog-cleanup-non-boardgames')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'catalog-cleanup-non-boardgames');

SELECT cron.schedule(
  'catalog-cleanup-non-boardgames',
  '30 3 * * *',
  $$
  DELETE FROM public.game_catalog
  WHERE bgg_verified_type IS NOT NULL
    AND bgg_verified_type NOT IN ('boardgame', 'boardgameexpansion');
  $$
);
