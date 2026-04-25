-- =============================================================================
-- Helper RPC: returns catalog IDs that don't yet have embeddings.
-- Run AFTER 01-migration.sql.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.catalog_embeddings_pending(p_limit INT DEFAULT 50)
RETURNS TABLE (id UUID)
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $func$
  SELECT g.id
  FROM public.game_catalog g
  LEFT JOIN public.catalog_embeddings e ON e.catalog_id = g.id
  WHERE g.is_expansion = false
    AND g.description IS NOT NULL
    AND length(g.description) > 80
    AND e.catalog_id IS NULL
  ORDER BY g.updated_at DESC NULLS LAST
  LIMIT p_limit;
$func$;

GRANT EXECUTE ON FUNCTION public.catalog_embeddings_pending(INT)
  TO service_role, authenticated;
