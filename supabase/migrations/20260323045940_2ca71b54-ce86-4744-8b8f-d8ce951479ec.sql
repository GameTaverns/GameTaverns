CREATE OR REPLACE FUNCTION public.search_catalog_by_mechanics(
  _mechanic_names text[],
  _search text DEFAULT '',
  _limit int DEFAULT 50,
  _offset int DEFAULT 0,
  _min_weight numeric DEFAULT NULL,
  _max_weight numeric DEFAULT NULL,
  _min_players int DEFAULT NULL,
  _max_players int DEFAULT NULL,
  _include_expansions boolean DEFAULT false,
  _updated_since timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  bgg_id text,
  title text,
  slug text,
  description text,
  image_url text,
  min_players int,
  max_players int,
  play_time_minutes int,
  weight numeric,
  year_published int,
  suggested_age text,
  is_expansion boolean,
  created_at timestamptz,
  updated_at timestamptz,
  mechanic_match_count bigint,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH matched_mechanics AS (
    SELECT m.id AS mechanic_id
    FROM mechanics m
    WHERE m.name = ANY(_mechanic_names)
  ),
  game_matches AS (
    SELECT cm.catalog_id, COUNT(DISTINCT cm.mechanic_id) AS match_count
    FROM catalog_mechanics cm
    JOIN matched_mechanics mm ON mm.mechanic_id = cm.mechanic_id
    GROUP BY cm.catalog_id
  ),
  filtered AS (
    SELECT gc.id, gc.bgg_id, gc.title, gc.slug, gc.description, gc.image_url,
           gc.min_players, gc.max_players, gc.play_time_minutes, gc.weight,
           gc.year_published, gc.suggested_age, gc.is_expansion,
           gc.created_at, gc.updated_at, gm.match_count
    FROM game_catalog gc
    JOIN game_matches gm ON gm.catalog_id = gc.id
    WHERE (_include_expansions OR gc.is_expansion = false)
      AND (_search = '' OR gc.title ILIKE '%' || _search || '%')
      AND (_min_weight IS NULL OR gc.weight >= _min_weight)
      AND (_max_weight IS NULL OR gc.weight <= _max_weight)
      AND (_min_players IS NULL OR gc.max_players >= _min_players)
      AND (_max_players IS NULL OR gc.min_players <= _max_players)
      AND (_updated_since IS NULL OR gc.updated_at >= _updated_since)
  ),
  counted AS (
    SELECT COUNT(*) AS cnt FROM filtered
  )
  SELECT
    f.id, f.bgg_id, f.title, f.slug, f.description, f.image_url,
    f.min_players, f.max_players, f.play_time_minutes, f.weight,
    f.year_published, f.suggested_age, f.is_expansion,
    f.created_at, f.updated_at,
    f.match_count AS mechanic_match_count,
    c.cnt AS total_count
  FROM filtered f, counted c
  ORDER BY f.match_count DESC, f.title ASC
  LIMIT _limit
  OFFSET _offset;
$$;