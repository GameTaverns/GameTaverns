
CREATE OR REPLACE FUNCTION public.get_catalog_session_counts()
RETURNS TABLE(catalog_id uuid, session_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT g.catalog_id, COUNT(gs.id) AS session_count
  FROM public.game_sessions gs
  JOIN public.games g ON g.id = gs.game_id
  WHERE g.catalog_id IS NOT NULL
  GROUP BY g.catalog_id
  HAVING COUNT(gs.id) > 0
  ORDER BY session_count DESC
  LIMIT 500;
$$;
