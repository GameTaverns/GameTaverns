
-- For NULL-bgg_id duplicates, keep the oldest entry (earliest created_at) and merge the rest

-- Reassign games.catalog_id to the canonical (oldest) entry
UPDATE public.games g
SET catalog_id = canonical.id
FROM public.game_catalog dup
JOIN LATERAL (
  SELECT gc2.id FROM public.game_catalog gc2
  WHERE gc2.title = dup.title AND gc2.bgg_id IS NULL
  ORDER BY gc2.created_at ASC
  LIMIT 1
) canonical ON true
WHERE g.catalog_id = dup.id
  AND dup.bgg_id IS NULL
  AND dup.id != canonical.id;

-- Delete orphaned junction records for entries about to be removed
DELETE FROM public.catalog_mechanics WHERE catalog_id IN (
  SELECT dup.id FROM public.game_catalog dup
  WHERE dup.bgg_id IS NULL
  AND dup.id != (
    SELECT gc2.id FROM public.game_catalog gc2
    WHERE gc2.title = dup.title AND gc2.bgg_id IS NULL
    ORDER BY gc2.created_at ASC LIMIT 1
  )
);
DELETE FROM public.catalog_publishers WHERE catalog_id IN (
  SELECT dup.id FROM public.game_catalog dup
  WHERE dup.bgg_id IS NULL
  AND dup.id != (
    SELECT gc2.id FROM public.game_catalog gc2
    WHERE gc2.title = dup.title AND gc2.bgg_id IS NULL
    ORDER BY gc2.created_at ASC LIMIT 1
  )
);
DELETE FROM public.catalog_designers WHERE catalog_id IN (
  SELECT dup.id FROM public.game_catalog dup
  WHERE dup.bgg_id IS NULL
  AND dup.id != (
    SELECT gc2.id FROM public.game_catalog gc2
    WHERE gc2.title = dup.title AND gc2.bgg_id IS NULL
    ORDER BY gc2.created_at ASC LIMIT 1
  )
);
DELETE FROM public.catalog_artists WHERE catalog_id IN (
  SELECT dup.id FROM public.game_catalog dup
  WHERE dup.bgg_id IS NULL
  AND dup.id != (
    SELECT gc2.id FROM public.game_catalog gc2
    WHERE gc2.title = dup.title AND gc2.bgg_id IS NULL
    ORDER BY gc2.created_at ASC LIMIT 1
  )
);

-- Delete the duplicate NULL-bgg_id entries (keep oldest per title)
DELETE FROM public.game_catalog
WHERE bgg_id IS NULL
AND id != (
  SELECT gc2.id FROM public.game_catalog gc2
  WHERE gc2.title = game_catalog.title AND gc2.bgg_id IS NULL
  ORDER BY gc2.created_at ASC LIMIT 1
);
