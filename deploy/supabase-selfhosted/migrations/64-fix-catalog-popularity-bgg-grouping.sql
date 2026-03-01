-- =============================================================================
-- Fix catalog_popularity view to aggregate by BGG ID
-- Version: 2.11.0
--
-- The previous view grouped by catalog entry ID, which meant duplicate catalog
-- entries sharing the same BGG ID would show separate (lower) counts instead
-- of aggregated totals. This version groups by BGG ID when available.
-- =============================================================================

DROP VIEW IF EXISTS public.catalog_popularity CASCADE;

CREATE OR REPLACE VIEW public.catalog_popularity WITH (security_invoker = true) AS
WITH catalog_groups AS (
    SELECT
        COALESCE(gc.bgg_id, gc.id::text) AS group_key,
        (MIN(gc.id::text))::uuid AS catalog_id,
        MIN(gc.title) AS title,
        MIN(gc.slug) AS slug,
        COALESCE(gc.bgg_id, gc.id::text) AS bgg_id,
        MIN(gc.image_url) AS image_url,
        MIN(gc.weight)::numeric(3,2) AS weight,
        MIN(gc.min_players) AS min_players,
        MIN(gc.max_players) AS max_players,
        MIN(gc.play_time_minutes) AS play_time_minutes
    FROM public.game_catalog gc
    GROUP BY COALESCE(gc.bgg_id, gc.id::text)
),
games_with_group AS (
    SELECT
        g.id AS game_id,
        g.library_id,
        g.ownership_status,
        COALESCE(gc_ref.bgg_id, g.catalog_id::text, g.bgg_id) AS group_key
    FROM public.games g
    LEFT JOIN public.game_catalog gc_ref ON gc_ref.id = g.catalog_id
),
ownership_by_group AS (
    SELECT
        group_key,
        COUNT(DISTINCT library_id) FILTER (WHERE ownership_status = 'owned') AS library_count
    FROM games_with_group
    WHERE group_key IS NOT NULL
    GROUP BY group_key
),
plays_by_group AS (
    SELECT
        gwg.group_key,
        COUNT(DISTINCT gs.id) AS total_plays
    FROM games_with_group gwg
    LEFT JOIN public.game_sessions gs ON gs.game_id = gwg.game_id
    WHERE gwg.group_key IS NOT NULL
    GROUP BY gwg.group_key
)
SELECT
    cg.catalog_id,
    cg.title,
    cg.slug,
    cg.bgg_id,
    cg.image_url,
    cg.weight,
    cg.min_players,
    cg.max_players,
    cg.play_time_minutes,
    COALESCE(obg.library_count, 0) AS library_count,
    COALESCE(pbg.total_plays, 0) AS total_plays
FROM catalog_groups cg
LEFT JOIN ownership_by_group obg ON obg.group_key = cg.group_key
LEFT JOIN plays_by_group pbg ON pbg.group_key = cg.group_key;

GRANT SELECT ON public.catalog_popularity TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
