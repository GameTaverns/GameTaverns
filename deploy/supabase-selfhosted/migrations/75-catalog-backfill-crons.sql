-- Catalog backfill cron jobs (comprehensive)
-- Manages the full lifecycle: type-check → enrichment → re-enrichment → dedup → cleanup

-- ─────────────────────────────────────────────────────────────────────
-- 1) Type-check: tags new entries with bgg_verified_type (every minute)
-- ─────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────
-- 2) Enrichment: backfill designers/mechanics/weight (every minute)
--    Processes 100 entries per run (5 BGG API calls of 20 IDs each)
-- ─────────────────────────────────────────────────────────────────────
SELECT cron.unschedule('catalog-enrichment-cron')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'catalog-enrichment-cron');

SELECT cron.schedule(
  'catalog-enrichment-cron',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'http://kong:8000/functions/v1/catalog-backfill',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"mode": "enrich", "batch_size": 100}'::jsonb
  ) AS request_id;
  $$
);

-- ─────────────────────────────────────────────────────────────────────
-- 3) Re-enrichment: refresh stale BGG ratings/weight monthly
--    Runs every 10 minutes — only touches entries >30 days old
-- ─────────────────────────────────────────────────────────────────────
SELECT cron.unschedule('catalog-re-enrich-cron')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'catalog-re-enrich-cron');

SELECT cron.schedule(
  'catalog-re-enrich-cron',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'http://kong:8000/functions/v1/catalog-backfill',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"mode": "re-enrich", "batch_size": 40}'::jsonb
  ) AS request_id;
  $$
);

-- ─────────────────────────────────────────────────────────────────────
-- 4) Dedup: merge duplicate catalog entries weekly (Sundays 2 AM)
-- ─────────────────────────────────────────────────────────────────────
SELECT cron.unschedule('catalog-dedup-cron')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'catalog-dedup-cron');

SELECT cron.schedule(
  'catalog-dedup-cron',
  '0 2 * * 0',
  $$
  SELECT net.http_post(
    url := 'http://kong:8000/functions/v1/catalog-backfill',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"mode": "dedup"}'::jsonb
  ) AS request_id;
  $$
);

-- ─────────────────────────────────────────────────────────────────────
-- 5) Cleanup: delete non-boardgame entries daily at 3:30 AM
-- ─────────────────────────────────────────────────────────────────────
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
