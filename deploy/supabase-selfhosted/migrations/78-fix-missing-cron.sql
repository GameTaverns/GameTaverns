-- Fix-missing cron: automatically re-enriches catalog entries that were marked
-- as enriched but are missing designers/artists (caused by BGG API errors during
-- initial enrichment pass).
-- Runs every 5 minutes, processing 100 entries per batch.
-- Self-healing: stops automatically when no incomplete entries remain.

SELECT cron.unschedule('catalog-fix-missing-cron')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'catalog-fix-missing-cron');

SELECT cron.schedule(
  'catalog-fix-missing-cron',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'http://kong:8000/functions/v1/catalog-backfill',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"mode": "fix-missing", "batch_size": 100}'::jsonb
  ) AS request_id;
  $$
);

-- Also update the enrichment status RPC to include missing_designers count
CREATE OR REPLACE FUNCTION public.get_catalog_enrichment_status()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'total_with_bgg', (SELECT count(*) FROM game_catalog WHERE bgg_id IS NOT NULL),
    'has_designers', (SELECT count(DISTINCT catalog_id) FROM catalog_designers),
    'has_artists', (SELECT count(DISTINCT catalog_id) FROM catalog_artists),
    'has_rating', (SELECT count(*) FROM game_catalog WHERE bgg_id IS NOT NULL AND bgg_community_rating IS NOT NULL AND bgg_community_rating > 0),
    'remaining', (
      SELECT count(*) FROM game_catalog gc
      WHERE gc.bgg_id IS NOT NULL
        AND gc.enriched_at IS NULL
    ),
    'missing_designers', (
      SELECT count(*) FROM game_catalog gc
      WHERE gc.bgg_id IS NOT NULL
        AND gc.enriched_at IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM catalog_designers cd WHERE cd.catalog_id = gc.id)
    )
  );
$$;
