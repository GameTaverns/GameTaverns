
-- =============================================================================
-- Backfill game_catalog.image_url from games table where catalog_id links them
-- Also sync additional_images from games → game_catalog
-- =============================================================================

-- Step 1: Backfill image_url into game_catalog from the games table
-- Pick the first non-null image_url from any game linked to this catalog entry
UPDATE public.game_catalog gc
SET image_url = (
  SELECT g.image_url
  FROM public.games g
  WHERE g.catalog_id = gc.id
    AND g.image_url IS NOT NULL
    AND g.image_url != ''
  ORDER BY g.created_at DESC
  LIMIT 1
)
WHERE gc.image_url IS NULL
  AND EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.catalog_id = gc.id AND g.image_url IS NOT NULL
  );

-- Step 2: Backfill additional_images into game_catalog from games table  
-- Aggregate all non-null additional_images arrays from linked games
UPDATE public.game_catalog gc
SET additional_images = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(g.additional_images)
    FROM public.games g
    WHERE g.catalog_id = gc.id
      AND g.additional_images IS NOT NULL
      AND array_length(g.additional_images, 1) > 0
  )
)
WHERE (gc.additional_images IS NULL OR gc.additional_images = '{}')
  AND EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.catalog_id = gc.id 
      AND g.additional_images IS NOT NULL 
      AND array_length(g.additional_images, 1) > 0
  );

-- Step 3: Also sync image_url from game_catalog back to linked games that have no image
-- (catalog entries enriched by scraper should share their image with library games)
UPDATE public.games g
SET image_url = gc.image_url
FROM public.game_catalog gc
WHERE g.catalog_id = gc.id
  AND g.image_url IS NULL
  AND gc.image_url IS NOT NULL;
