CREATE OR REPLACE FUNCTION public.get_catalog_entries_without_genres(p_limit integer DEFAULT 50, p_include_expansions boolean DEFAULT true)
 RETURNS TABLE(id uuid, title text, description text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT gc.id, gc.title, gc.description
  FROM public.game_catalog gc
  WHERE gc.description IS NOT NULL
    AND LENGTH(gc.description) > 10
    AND (p_include_expansions OR gc.is_expansion = false)
    AND NOT EXISTS (
      SELECT 1 FROM public.catalog_genres cg WHERE cg.catalog_id = gc.id
    )
  ORDER BY gc.created_at ASC
  LIMIT p_limit;
$function$;