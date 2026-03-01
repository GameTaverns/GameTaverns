-- =============================================================================
-- Fix catalog_popularity view to aggregate by BGG ID
-- Version: 2.11.0
--
-- The previous view grouped by catalog entry ID, which meant duplicate catalog
-- entries sharing the same BGG ID would show separate (lower) counts instead
-- of aggregated totals. This version groups by BGG ID when available.
-- =============================================================================

CREATE OR REPLACE VIEW public.catalog_popularity WITH (security_invoker = true) AS
SELECT
    -- Pick the first catalog entry as the representative (uuid has no MIN, cast to text)
    (MIN(gc.id::text))::uuid AS catalog_id,
    MIN(gc.title) AS title,
    MIN(gc.slug) AS slug,
    COALESCE(gc.bgg_id, gc.id::text) AS bgg_id,
    MIN(gc.image_url) AS image_url,
    MIN(gc.weight) AS weight,
    MIN(gc.min_players) AS min_players,
    MIN(gc.max_players) AS max_players,
    MIN(gc.play_time_minutes) AS play_time_minutes,
    COUNT(DISTINCT g.library_id) FILTER (WHERE g.ownership_status = 'owned') AS library_count,
    COUNT(DISTINCT gs.id) AS total_plays
FROM public.game_catalog gc
LEFT JOIN public.games g ON g.catalog_id = gc.id
LEFT JOIN public.game_sessions gs ON gs.game_id = g.id
GROUP BY COALESCE(gc.bgg_id, gc.id::text);

GRANT SELECT ON public.catalog_popularity TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
