
-- Drop bgg_community_rating column from game_catalog
ALTER TABLE public.game_catalog DROP COLUMN IF EXISTS bgg_community_rating;

-- Update the enrichment status function to remove rating tracking
CREATE OR REPLACE FUNCTION public.get_catalog_enrichment_status()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'total_with_bgg', (SELECT count(*) FROM game_catalog WHERE bgg_id IS NOT NULL),
    'has_designers', (SELECT count(DISTINCT catalog_id) FROM catalog_designers),
    'has_artists', (SELECT count(DISTINCT catalog_id) FROM catalog_artists),
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
$function$;
