-- =============================================================================
-- PHASE 1: SEMANTIC SEARCH — BACKFILL CRON
-- Run AFTER 01-migration.sql, 02-pending-rpc.sql, AND after the embed-catalog
-- edge function is deployed and CORTEX_EMBEDDINGS_URL is set.
-- =============================================================================
--
-- Schedules a job every 5 minutes that embeds up to 200 un-embedded games.
-- Once caught up, the function cheaply returns { processed: 0 }.
--
-- IMPORTANT: replace YOUR_SERVICE_ROLE_KEY below with the actual service-role
-- JWT from your VPS .env (SERVICE_ROLE_KEY).
-- =============================================================================

SELECT cron.schedule(
  'catalog-embeddings-backfill',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url     := 'http://gametaverns-functions:9000/embed-catalog',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body    := jsonb_build_object('mode', 'backfill', 'limit', 200)
  );
  $cron$
);

-- Monitor progress:
-- SELECT
--   (SELECT COUNT(*) FROM game_catalog WHERE is_expansion = false AND description IS NOT NULL) AS total_eligible,
--   (SELECT COUNT(*) FROM catalog_embeddings) AS embedded,
--   round(100.0 * (SELECT COUNT(*) FROM catalog_embeddings)
--         / NULLIF((SELECT COUNT(*) FROM game_catalog WHERE is_expansion = false AND description IS NOT NULL), 0), 1) AS pct_complete;

-- To stop once complete (optional):
-- SELECT cron.unschedule('catalog-embeddings-backfill');
