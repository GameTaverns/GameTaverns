CREATE OR REPLACE VIEW public.catalog_popularity WITH (security_invoker = true) AS
SELECT
    gc.id AS catalog_id,
    gc.title,
    gc.slug,
    gc.bgg_id,
    gc.image_url,
    gc.weight,
    gc.min_players,
    gc.max_players,
    gc.play_time_minutes,
    COUNT(DISTINCT g.library_id) FILTER (WHERE g.ownership_status = 'owned') AS library_count,
    COUNT(DISTINCT gs.id) AS total_plays
FROM public.game_catalog gc
LEFT JOIN public.games g ON g.catalog_id = gc.id
LEFT JOIN public.game_sessions gs ON gs.game_id = g.id
GROUP BY gc.id, gc.title, gc.slug, gc.bgg_id, gc.image_url, gc.weight, gc.min_players, gc.max_players, gc.play_time_minutes;