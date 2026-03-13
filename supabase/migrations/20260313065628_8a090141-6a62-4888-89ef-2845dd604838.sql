
DROP FUNCTION IF EXISTS public.discover_similar_users(uuid, integer);

CREATE OR REPLACE FUNCTION public.discover_similar_users(_user_id uuid, _limit integer DEFAULT 12)
 RETURNS TABLE(user_id uuid, username text, display_name text, avatar_url text, bio text, games_owned bigint, sessions_logged bigint, primary_archetype text, shared_mechanics bigint, shared_games bigint, top_shared_games text[], similarity_score numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH my_library AS (
    SELECT l.id FROM libraries l WHERE l.owner_id = _user_id LIMIT 1
  ),
  my_archetype AS (
    SELECT a.primary_archetype, a.secondary_archetype
    FROM archetype_snapshots a
    JOIN my_library ml ON ml.id = a.library_id
    ORDER BY a.created_at DESC
    LIMIT 1
  ),
  my_families AS (
    SELECT DISTINCT m.family_id FROM (
      SELECT gm.mechanic_id
      FROM game_mechanics gm
      JOIN games g ON g.id = gm.game_id
      JOIN my_library ml ON ml.id = g.library_id
      UNION
      SELECT cm.mechanic_id
      FROM catalog_mechanics cm
      JOIN games g ON g.catalog_id = cm.catalog_id
      JOIN my_library ml ON ml.id = g.library_id
    ) combined
    JOIN mechanics m ON m.id = combined.mechanic_id
    WHERE m.family_id IS NOT NULL
  ),
  my_catalog_ids AS (
    SELECT DISTINCT g.catalog_id
    FROM games g
    JOIN my_library ml ON ml.id = g.library_id
    WHERE g.catalog_id IS NOT NULL
  ),
  other_libraries AS (
    SELECT l.id AS library_id, l.owner_id AS other_user_id
    FROM libraries l
    JOIN library_settings ls ON ls.library_id = l.id
    WHERE l.owner_id != _user_id
      AND ls.is_discoverable = true
  ),
  other_archetypes AS (
    SELECT DISTINCT ON (ol.other_user_id)
      ol.other_user_id,
      a.primary_archetype
    FROM archetype_snapshots a
    JOIN other_libraries ol ON ol.library_id = a.library_id
    ORDER BY ol.other_user_id, a.created_at DESC
  ),
  family_overlap AS (
    SELECT other_user_id, COUNT(DISTINCT family_id) AS shared_count
    FROM (
      SELECT ol.other_user_id, m.family_id
      FROM game_mechanics gm
      JOIN games g ON g.id = gm.game_id
      JOIN other_libraries ol ON ol.library_id = g.library_id
      JOIN mechanics m ON m.id = gm.mechanic_id
      JOIN my_families mf ON mf.family_id = m.family_id
      WHERE m.family_id IS NOT NULL
      UNION
      SELECT ol.other_user_id, m.family_id
      FROM catalog_mechanics cm
      JOIN games g ON g.catalog_id = cm.catalog_id
      JOIN other_libraries ol ON ol.library_id = g.library_id
      JOIN mechanics m ON m.id = cm.mechanic_id
      JOIN my_families mf ON mf.family_id = m.family_id
      WHERE m.family_id IS NOT NULL
    ) combined
    GROUP BY other_user_id
  ),
  game_overlap AS (
    SELECT
      ol.other_user_id,
      COUNT(DISTINCT g.catalog_id) AS shared_game_count,
      (ARRAY_AGG(DISTINCT g.title ORDER BY g.title))[1:3] AS top_titles
    FROM games g
    JOIN other_libraries ol ON ol.library_id = g.library_id
    JOIN my_catalog_ids mci ON mci.catalog_id = g.catalog_id
    GROUP BY ol.other_user_id
  ),
  scored AS (
    SELECT
      ol.other_user_id,
      COALESCE(fo.shared_count, 0) AS shared_mechanics,
      COALESCE(go.shared_game_count, 0) AS shared_games,
      COALESCE(go.top_titles, '{}') AS top_shared_games,
      oa.primary_archetype,
      (
        COALESCE(fo.shared_count, 0) * 3
        + COALESCE(go.shared_game_count, 0)
        + CASE WHEN oa.primary_archetype = (SELECT primary_archetype FROM my_archetype) THEN 20 ELSE 0 END
        + CASE WHEN oa.primary_archetype = (SELECT secondary_archetype FROM my_archetype) THEN 10 ELSE 0 END
      )::numeric AS similarity_score
    FROM other_libraries ol
    LEFT JOIN family_overlap fo ON fo.other_user_id = ol.other_user_id
    LEFT JOIN game_overlap go ON go.other_user_id = ol.other_user_id
    LEFT JOIN other_archetypes oa ON oa.other_user_id = ol.other_user_id
    WHERE NOT EXISTS (
      SELECT 1 FROM user_follows uf
      WHERE uf.follower_id = _user_id AND uf.following_id = ol.other_user_id
    )
    GROUP BY ol.other_user_id, fo.shared_count, go.shared_game_count, go.top_titles, oa.primary_archetype
  )
  SELECT
    s.other_user_id AS user_id,
    up.username::text,
    up.display_name::text,
    up.avatar_url::text,
    up.bio::text,
    up.games_owned,
    up.sessions_logged,
    s.primary_archetype::text,
    s.shared_mechanics,
    s.shared_games,
    s.top_shared_games,
    s.similarity_score
  FROM scored s
  JOIN public_user_profiles up ON up.user_id = s.other_user_id
  WHERE up.username IS NOT NULL
    AND s.similarity_score > 0
  ORDER BY s.similarity_score DESC
  LIMIT _limit;
$function$;
