ALTER TABLE public.game_catalog ADD COLUMN IF NOT EXISTS enriched_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_game_catalog_unenriched ON public.game_catalog (created_at ASC) WHERE bgg_id IS NOT NULL AND enriched_at IS NULL;

-- Update the RPC to use enriched_at instead of checking for missing designers
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