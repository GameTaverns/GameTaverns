-- RPC to efficiently find catalog entries missing designers
-- Uses NOT EXISTS instead of post-filtering in application code

CREATE OR REPLACE FUNCTION public.get_missing_designer_entries(p_limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, bgg_id text, title text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT gc.id, gc.bgg_id, gc.title
  FROM game_catalog gc
  WHERE gc.bgg_id IS NOT NULL
    AND gc.enriched_at IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM catalog_designers cd WHERE cd.catalog_id = gc.id)
  ORDER BY gc.created_at ASC
  LIMIT p_limit;
$$;

NOTIFY pgrst, 'reload schema';
