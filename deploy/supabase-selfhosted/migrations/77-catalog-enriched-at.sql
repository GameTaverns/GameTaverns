-- Add enriched_at column to track which catalog entries have been enriched
-- Fixes stuck loop where games with no designers on BGG get re-processed forever

ALTER TABLE public.game_catalog ADD COLUMN IF NOT EXISTS enriched_at timestamptz DEFAULT NULL;

-- Backfill: mark entries that already have designers as enriched
UPDATE public.game_catalog gc
SET enriched_at = gc.updated_at
WHERE gc.enriched_at IS NULL
  AND EXISTS (SELECT 1 FROM public.catalog_designers cd WHERE cd.catalog_id = gc.id);

-- Index for fast lookup of unenriched entries
CREATE INDEX IF NOT EXISTS idx_game_catalog_unenriched
  ON public.game_catalog (created_at ASC)
  WHERE bgg_id IS NOT NULL AND enriched_at IS NULL;

-- Update RPC to use enriched_at instead of checking for missing designers
CREATE OR REPLACE FUNCTION public.get_unenriched_catalog_entries(p_limit integer DEFAULT 5)
 RETURNS TABLE(id uuid, bgg_id text, title text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT gc.id, gc.bgg_id, gc.title
  FROM game_catalog gc
  WHERE gc.bgg_id IS NOT NULL
    AND gc.enriched_at IS NULL
  ORDER BY gc.created_at ASC
  LIMIT p_limit;
$$;

-- Update enrichment status RPC to use new column
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
