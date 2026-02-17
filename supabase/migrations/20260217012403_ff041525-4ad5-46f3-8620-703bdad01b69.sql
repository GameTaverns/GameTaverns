
-- Step 1: For each title that has both a bgg_id entry and NULL-bgg_id duplicates,
-- reassign all foreign key references from duplicates to the canonical entry.

-- Build a mapping: for each duplicate (NULL bgg_id), find the canonical (non-NULL bgg_id) entry with same title
-- We pick the canonical as the one with a bgg_id (if multiple, pick the one with lowest bgg_id)

-- Reassign games.catalog_id
UPDATE public.games g
SET catalog_id = canonical.id
FROM public.game_catalog dup
JOIN LATERAL (
  SELECT gc2.id FROM public.game_catalog gc2
  WHERE gc2.title = dup.title AND gc2.bgg_id IS NOT NULL
  ORDER BY gc2.bgg_id::integer ASC
  LIMIT 1
) canonical ON true
WHERE g.catalog_id = dup.id
  AND dup.bgg_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.game_catalog gc3
    WHERE gc3.title = dup.title AND gc3.bgg_id IS NOT NULL AND gc3.id != dup.id
  );

-- Reassign catalog_mechanics
UPDATE public.catalog_mechanics cm
SET catalog_id = canonical.id
FROM public.game_catalog dup
JOIN LATERAL (
  SELECT gc2.id FROM public.game_catalog gc2
  WHERE gc2.title = dup.title AND gc2.bgg_id IS NOT NULL
  ORDER BY gc2.bgg_id::integer ASC
  LIMIT 1
) canonical ON true
WHERE cm.catalog_id = dup.id
  AND dup.bgg_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.game_catalog gc3
    WHERE gc3.title = dup.title AND gc3.bgg_id IS NOT NULL AND gc3.id != dup.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.catalog_mechanics existing
    WHERE existing.catalog_id = canonical.id AND existing.mechanic_id = cm.mechanic_id
  );

-- Reassign catalog_publishers
UPDATE public.catalog_publishers cp
SET catalog_id = canonical.id
FROM public.game_catalog dup
JOIN LATERAL (
  SELECT gc2.id FROM public.game_catalog gc2
  WHERE gc2.title = dup.title AND gc2.bgg_id IS NOT NULL
  ORDER BY gc2.bgg_id::integer ASC
  LIMIT 1
) canonical ON true
WHERE cp.catalog_id = dup.id
  AND dup.bgg_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.game_catalog gc3
    WHERE gc3.title = dup.title AND gc3.bgg_id IS NOT NULL AND gc3.id != dup.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.catalog_publishers existing
    WHERE existing.catalog_id = canonical.id AND existing.publisher_id = cp.publisher_id
  );

-- Reassign catalog_designers
UPDATE public.catalog_designers cd
SET catalog_id = canonical.id
FROM public.game_catalog dup
JOIN LATERAL (
  SELECT gc2.id FROM public.game_catalog gc2
  WHERE gc2.title = dup.title AND gc2.bgg_id IS NOT NULL
  ORDER BY gc2.bgg_id::integer ASC
  LIMIT 1
) canonical ON true
WHERE cd.catalog_id = dup.id
  AND dup.bgg_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.game_catalog gc3
    WHERE gc3.title = dup.title AND gc3.bgg_id IS NOT NULL AND gc3.id != dup.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.catalog_designers existing
    WHERE existing.catalog_id = canonical.id AND existing.designer_id = cd.designer_id
  );

-- Reassign catalog_artists
UPDATE public.catalog_artists ca
SET catalog_id = canonical.id
FROM public.game_catalog dup
JOIN LATERAL (
  SELECT gc2.id FROM public.game_catalog gc2
  WHERE gc2.title = dup.title AND gc2.bgg_id IS NOT NULL
  ORDER BY gc2.bgg_id::integer ASC
  LIMIT 1
) canonical ON true
WHERE ca.catalog_id = dup.id
  AND dup.bgg_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.game_catalog gc3
    WHERE gc3.title = dup.title AND gc3.bgg_id IS NOT NULL AND gc3.id != dup.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.catalog_artists existing
    WHERE existing.catalog_id = canonical.id AND existing.artist_id = ca.artist_id
  );

-- Reassign catalog_videos
UPDATE public.catalog_videos cv
SET catalog_id = canonical.id
FROM public.game_catalog dup
JOIN LATERAL (
  SELECT gc2.id FROM public.game_catalog gc2
  WHERE gc2.title = dup.title AND gc2.bgg_id IS NOT NULL
  ORDER BY gc2.bgg_id::integer ASC
  LIMIT 1
) canonical ON true
WHERE cv.catalog_id = dup.id
  AND dup.bgg_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.game_catalog gc3
    WHERE gc3.title = dup.title AND gc3.bgg_id IS NOT NULL AND gc3.id != dup.id
  );

-- Reassign catalog_corrections
UPDATE public.catalog_corrections cc
SET catalog_id = canonical.id
FROM public.game_catalog dup
JOIN LATERAL (
  SELECT gc2.id FROM public.game_catalog gc2
  WHERE gc2.title = dup.title AND gc2.bgg_id IS NOT NULL
  ORDER BY gc2.bgg_id::integer ASC
  LIMIT 1
) canonical ON true
WHERE cc.catalog_id = dup.id
  AND dup.bgg_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.game_catalog gc3
    WHERE gc3.title = dup.title AND gc3.bgg_id IS NOT NULL AND gc3.id != dup.id
  );

-- Step 2: Delete orphaned junction records for duplicates about to be removed
DELETE FROM public.catalog_mechanics WHERE catalog_id IN (
  SELECT dup.id FROM public.game_catalog dup
  WHERE dup.bgg_id IS NULL
  AND EXISTS (SELECT 1 FROM public.game_catalog gc2 WHERE gc2.title = dup.title AND gc2.bgg_id IS NOT NULL AND gc2.id != dup.id)
);
DELETE FROM public.catalog_publishers WHERE catalog_id IN (
  SELECT dup.id FROM public.game_catalog dup
  WHERE dup.bgg_id IS NULL
  AND EXISTS (SELECT 1 FROM public.game_catalog gc2 WHERE gc2.title = dup.title AND gc2.bgg_id IS NOT NULL AND gc2.id != dup.id)
);
DELETE FROM public.catalog_designers WHERE catalog_id IN (
  SELECT dup.id FROM public.game_catalog dup
  WHERE dup.bgg_id IS NULL
  AND EXISTS (SELECT 1 FROM public.game_catalog gc2 WHERE gc2.title = dup.title AND gc2.bgg_id IS NOT NULL AND gc2.id != dup.id)
);
DELETE FROM public.catalog_artists WHERE catalog_id IN (
  SELECT dup.id FROM public.game_catalog dup
  WHERE dup.bgg_id IS NULL
  AND EXISTS (SELECT 1 FROM public.game_catalog gc2 WHERE gc2.title = dup.title AND gc2.bgg_id IS NOT NULL AND gc2.id != dup.id)
);

-- Step 3: Delete the NULL-bgg_id duplicates where a bgg_id version exists
DELETE FROM public.game_catalog
WHERE bgg_id IS NULL
AND EXISTS (
  SELECT 1 FROM public.game_catalog gc2
  WHERE gc2.title = game_catalog.title AND gc2.bgg_id IS NOT NULL AND gc2.id != game_catalog.id
);
