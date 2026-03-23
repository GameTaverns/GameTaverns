
CREATE OR REPLACE FUNCTION public.get_catalog_entries_without_mechanics(p_limit integer DEFAULT 30)
RETURNS TABLE(id uuid, title text, description text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT gc.id, gc.title, gc.description
  FROM public.game_catalog gc
  WHERE gc.is_expansion = false
    AND gc.description IS NOT NULL
    AND LENGTH(gc.description) > 50
    AND NOT EXISTS (
      SELECT 1 FROM public.catalog_mechanics cm WHERE cm.catalog_id = gc.id
    )
  ORDER BY gc.created_at ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_catalog_entries_without_mechanics(integer) TO authenticated, anon, service_role;
