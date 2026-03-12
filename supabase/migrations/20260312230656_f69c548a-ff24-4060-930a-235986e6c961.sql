
CREATE OR REPLACE FUNCTION public.compare_libraries(user_a uuid, user_b uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Verify user_a follows user_b
  IF NOT EXISTS (
    SELECT 1 FROM public.user_follows
    WHERE follower_id = user_a AND following_id = user_b
  ) THEN
    RAISE EXCEPTION 'You must follow this user to compare libraries';
  END IF;

  WITH
  -- Get games for user A (by catalog_id for matching)
  user_a_games AS (
    SELECT g.id, g.title, g.image_url, g.slug, g.catalog_id,
           gc.min_players, gc.max_players, gc.play_time_minutes, gc.weight,
           COALESCE((SELECT COUNT(*) FROM game_sessions gs WHERE gs.game_id = g.id), 0) as play_count
    FROM games g
    JOIN libraries l ON l.id = g.library_id
    LEFT JOIN game_catalog gc ON gc.id = g.catalog_id
    WHERE l.owner_id = user_a AND g.is_expansion = false
  ),
  -- Get games for user B
  user_b_games AS (
    SELECT g.id, g.title, g.image_url, g.slug, g.catalog_id,
           gc.min_players, gc.max_players, gc.play_time_minutes, gc.weight,
           COALESCE((SELECT COUNT(*) FROM game_sessions gs WHERE gs.game_id = g.id), 0) as play_count
    FROM games g
    JOIN libraries l ON l.id = g.library_id
    LEFT JOIN game_catalog gc ON gc.id = g.catalog_id
    WHERE l.owner_id = user_b AND g.is_expansion = false
  ),
  -- Shared games (matched by catalog_id)
  shared AS (
    SELECT a.title, a.image_url, a.slug, a.catalog_id,
           a.play_count as a_plays, b.play_count as b_plays,
           a.min_players, a.max_players, a.play_time_minutes, a.weight
    FROM user_a_games a
    JOIN user_b_games b ON a.catalog_id = b.catalog_id
    WHERE a.catalog_id IS NOT NULL
  ),
  -- Unique to A
  unique_a AS (
    SELECT a.title, a.image_url, a.slug
    FROM user_a_games a
    WHERE a.catalog_id IS NULL
       OR a.catalog_id NOT IN (SELECT catalog_id FROM user_b_games WHERE catalog_id IS NOT NULL)
    LIMIT 20
  ),
  -- Unique to B
  unique_b AS (
    SELECT b.title, b.image_url, b.slug
    FROM user_b_games b
    WHERE b.catalog_id IS NULL
       OR b.catalog_id NOT IN (SELECT catalog_id FROM user_a_games WHERE catalog_id IS NOT NULL)
    LIMIT 20
  ),
  -- Stats
  stats_a AS (
    SELECT COUNT(*) as total,
           ROUND(AVG(weight)::numeric, 2) as avg_weight,
           ROUND(AVG(play_time_minutes)::numeric, 0) as avg_playtime,
           SUM(play_count) as total_plays
    FROM user_a_games
  ),
  stats_b AS (
    SELECT COUNT(*) as total,
           ROUND(AVG(weight)::numeric, 2) as avg_weight,
           ROUND(AVG(play_time_minutes)::numeric, 0) as avg_playtime,
           SUM(play_count) as total_plays
    FROM user_b_games
  ),
  -- Play compatibility: shared games both have played
  compatible AS (
    SELECT title, image_url, slug, min_players, max_players, play_time_minutes, weight,
           a_plays + b_plays as combined_plays
    FROM shared
    WHERE a_plays > 0 AND b_plays > 0
    ORDER BY combined_plays DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'shared_games', COALESCE((SELECT jsonb_agg(row_to_json(s)) FROM shared s), '[]'::jsonb),
    'shared_count', (SELECT COUNT(*) FROM shared),
    'unique_a', COALESCE((SELECT jsonb_agg(row_to_json(ua)) FROM unique_a ua), '[]'::jsonb),
    'unique_a_count', (SELECT COUNT(*) FROM user_a_games) - (SELECT COUNT(*) FROM shared),
    'unique_b', COALESCE((SELECT jsonb_agg(row_to_json(ub)) FROM unique_b ub), '[]'::jsonb),
    'unique_b_count', (SELECT COUNT(*) FROM user_b_games) - (SELECT COUNT(*) FROM shared),
    'stats_a', (SELECT row_to_json(sa) FROM stats_a sa),
    'stats_b', (SELECT row_to_json(sb) FROM stats_b sb),
    'play_together', COALESCE((SELECT jsonb_agg(row_to_json(c)) FROM compatible c), '[]'::jsonb),
    'compatibility_score', CASE 
      WHEN (SELECT COUNT(*) FROM user_a_games) + (SELECT COUNT(*) FROM user_b_games) = 0 THEN 0
      ELSE ROUND(
        (SELECT COUNT(*) FROM shared)::numeric * 2.0 / 
        NULLIF((SELECT COUNT(*) FROM user_a_games) + (SELECT COUNT(*) FROM user_b_games), 0) * 100
      , 1)
    END
  ) INTO result;

  RETURN result;
END;
$$;
