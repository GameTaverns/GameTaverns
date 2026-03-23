-- 1. Update search_catalog_by_mechanics to resolve family names → child mechanics
CREATE OR REPLACE FUNCTION public.search_catalog_by_mechanics(
  _mechanic_names text[],
  _search text DEFAULT '',
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0,
  _min_weight numeric DEFAULT NULL,
  _max_weight numeric DEFAULT NULL,
  _min_players integer DEFAULT NULL,
  _max_players integer DEFAULT NULL,
  _include_expansions boolean DEFAULT false,
  _updated_since timestamptz DEFAULT NULL
)
RETURNS TABLE(
  id uuid, bgg_id text, title text, slug text, description text, image_url text,
  min_players integer, max_players integer, play_time_minutes integer, weight numeric,
  year_published integer, suggested_age text, is_expansion boolean,
  created_at timestamptz, updated_at timestamptz,
  mechanic_match_count bigint, total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH resolved_mechanics AS (
    -- Resolve family names to all child mechanic IDs
    SELECT DISTINCT m.id
    FROM public.mechanics m
    JOIN public.mechanic_families mf ON mf.id = m.family_id
    WHERE mf.name = ANY(_mechanic_names)
    UNION
    -- Also match exact mechanic names as fallback
    SELECT m.id
    FROM public.mechanics m
    WHERE m.name = ANY(_mechanic_names)
  ),
  catalog_hits AS (
    SELECT cm.catalog_id, cm.mechanic_id
    FROM public.catalog_mechanics cm
    JOIN resolved_mechanics rm ON rm.id = cm.mechanic_id
  ),
  library_hits AS (
    SELECT DISTINCT g.catalog_id, gm.mechanic_id
    FROM public.game_mechanics gm
    JOIN resolved_mechanics rm ON rm.id = gm.mechanic_id
    JOIN public.games g ON g.id = gm.game_id
    WHERE g.catalog_id IS NOT NULL
  ),
  all_hits AS (
    SELECT catalog_id, mechanic_id FROM catalog_hits
    UNION
    SELECT catalog_id, mechanic_id FROM library_hits
  )
  SELECT
    gc.id, gc.bgg_id, gc.title, gc.slug, gc.description, gc.image_url,
    gc.min_players, gc.max_players, gc.play_time_minutes, gc.weight,
    gc.year_published, gc.suggested_age, gc.is_expansion,
    gc.created_at, gc.updated_at,
    COUNT(DISTINCT ah.mechanic_id) AS mechanic_match_count,
    NULL::bigint AS total_count
  FROM all_hits ah
  JOIN public.game_catalog gc ON gc.id = ah.catalog_id
  WHERE (_include_expansions OR gc.is_expansion = false)
    AND (_search = '' OR gc.title ILIKE '%' || _search || '%')
    AND (_min_weight IS NULL OR gc.weight >= _min_weight)
    AND (_max_weight IS NULL OR gc.weight <= _max_weight)
    AND (_min_players IS NULL OR gc.max_players >= _min_players)
    AND (_max_players IS NULL OR gc.min_players <= _max_players)
    AND (_updated_since IS NULL OR gc.updated_at >= _updated_since)
  GROUP BY gc.id, gc.bgg_id, gc.title, gc.slug, gc.description, gc.image_url,
    gc.min_players, gc.max_players, gc.play_time_minutes, gc.weight,
    gc.year_published, gc.suggested_age, gc.is_expansion, gc.created_at, gc.updated_at
  ORDER BY COUNT(DISTINCT ah.mechanic_id) DESC, gc.title ASC
  LIMIT _limit
  OFFSET _offset;
$$;

-- 2. Update get_catalog_filter_options to return family names instead of granular mechanics
CREATE OR REPLACE FUNCTION public.get_catalog_filter_options()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'designers', COALESCE((
      SELECT jsonb_agg(DISTINCT d.name ORDER BY d.name)
      FROM catalog_designers cd
      JOIN designers d ON d.id = cd.designer_id
    ), '[]'::jsonb),
    'artists', COALESCE((
      SELECT jsonb_agg(DISTINCT a.name ORDER BY a.name)
      FROM catalog_artists ca
      JOIN artists a ON a.id = ca.artist_id
    ), '[]'::jsonb),
    'mechanics', COALESCE((
      SELECT jsonb_agg(DISTINCT mf.name ORDER BY mf.name)
      FROM catalog_mechanics cm
      JOIN mechanics m ON m.id = cm.mechanic_id
      JOIN mechanic_families mf ON mf.id = m.family_id
    ), '[]'::jsonb),
    'publishers', COALESCE((
      SELECT jsonb_agg(DISTINCT p.name ORDER BY p.name)
      FROM catalog_publishers cp
      JOIN publishers p ON p.id = cp.publisher_id
    ), '[]'::jsonb)
  );
$$;