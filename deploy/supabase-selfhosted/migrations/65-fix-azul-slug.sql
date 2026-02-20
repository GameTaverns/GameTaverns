-- =============================================================================
-- Fix: Azul slug collision
-- Version: 2.9.2
--
-- On self-hosted instances, the dedup migration may have caused the "Azul"
-- catalog entry (bgg_id=230802) to inherit the slug 'azul-mini' if the
-- Azul Mini NULL-bgg_id entry was merged into it incorrectly.
-- This migration corrects slugs so each game has the right slug.
-- =============================================================================

-- Ensure "Azul" (bgg_id=230802) has slug 'azul'
UPDATE public.game_catalog
SET slug = 'azul'
WHERE bgg_id = '230802'
  AND slug != 'azul';

-- Ensure "Azul: Stained Glass of Sintra" (bgg_id=256226) has correct slug
UPDATE public.game_catalog
SET slug = 'azul-stained-glass-of-sintra'
WHERE bgg_id = '256226'
  AND slug != 'azul-stained-glass-of-sintra';

-- If "Azul Mini" doesn't exist as its own catalog entry (was wrongly merged
-- into Azul), recreate it so library games can link to it properly.
-- BGG ID for Azul Mini is 167355.
INSERT INTO public.game_catalog (title, slug, bgg_id, is_expansion)
SELECT 'Azul Mini', 'azul-mini', '167355', false
WHERE NOT EXISTS (
  SELECT 1 FROM public.game_catalog WHERE slug = 'azul-mini'
)
AND NOT EXISTS (
  SELECT 1 FROM public.game_catalog WHERE bgg_id = '167355'
);

-- If "Azul Mini" exists with bgg_id but wrong slug, fix the slug
UPDATE public.game_catalog
SET slug = 'azul-mini'
WHERE bgg_id = '167355'
  AND slug != 'azul-mini';

-- If "Azul Mini" exists as a NULL bgg_id entry with correct slug, keep it
-- but ensure no other entry has that slug
UPDATE public.game_catalog
SET slug = 'azul'
WHERE title = 'Azul'
  AND bgg_id = '230802'
  AND slug = 'azul-mini';

-- Fix any games in libraries that are pointing to the wrong catalog entry
-- (azul-mini games should point to azul-mini catalog, not azul catalog)
UPDATE public.games g
SET catalog_id = correct.id
FROM public.game_catalog correct
WHERE correct.slug = 'azul-mini'
  AND g.title = 'Azul Mini'
  AND g.catalog_id != correct.id
  AND EXISTS (
    SELECT 1 FROM public.game_catalog wrong
    WHERE wrong.id = g.catalog_id AND wrong.slug != 'azul-mini'
  );
