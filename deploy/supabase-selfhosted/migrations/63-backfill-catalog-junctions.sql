-- =============================================================================
-- Backfill catalog junction tables from existing library game data
-- Version: 2.9.0
-- =============================================================================

-- Backfill catalog_mechanics from game_mechanics via games.catalog_id
INSERT INTO public.catalog_mechanics (catalog_id, mechanic_id)
SELECT DISTINCT g.catalog_id, gm.mechanic_id
FROM public.game_mechanics gm
JOIN public.games g ON g.id = gm.game_id
WHERE g.catalog_id IS NOT NULL
ON CONFLICT (catalog_id, mechanic_id) DO NOTHING;

-- Backfill catalog_publishers from games.publisher_id via games.catalog_id
INSERT INTO public.catalog_publishers (catalog_id, publisher_id)
SELECT DISTINCT g.catalog_id, g.publisher_id
FROM public.games g
WHERE g.catalog_id IS NOT NULL AND g.publisher_id IS NOT NULL
ON CONFLICT (catalog_id, publisher_id) DO NOTHING;

-- Backfill catalog_designers from game_designers via games.catalog_id
INSERT INTO public.catalog_designers (catalog_id, designer_id)
SELECT DISTINCT g.catalog_id, gd.designer_id
FROM public.game_designers gd
JOIN public.games g ON g.id = gd.game_id
WHERE g.catalog_id IS NOT NULL
ON CONFLICT (catalog_id, designer_id) DO NOTHING;

-- Backfill catalog_artists from game_artists via games.catalog_id
INSERT INTO public.catalog_artists (catalog_id, artist_id)
SELECT DISTINCT g.catalog_id, ga.artist_id
FROM public.game_artists ga
JOIN public.games g ON g.id = ga.game_id
WHERE g.catalog_id IS NOT NULL
ON CONFLICT (catalog_id, artist_id) DO NOTHING;
