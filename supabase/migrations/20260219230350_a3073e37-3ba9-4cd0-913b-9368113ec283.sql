
-- Create a function to get unenriched catalog entries (missing designers)
-- This is much more efficient than NOT IN with thousands of IDs
CREATE OR REPLACE FUNCTION get_unenriched_catalog_entries(p_limit int DEFAULT 5)
RETURNS TABLE(id uuid, bgg_id text, title text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gc.id, gc.bgg_id, gc.title
  FROM game_catalog gc
  WHERE gc.bgg_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM catalog_designers cd WHERE cd.catalog_id = gc.id
    )
  ORDER BY gc.created_at ASC
  LIMIT p_limit;
$$;
