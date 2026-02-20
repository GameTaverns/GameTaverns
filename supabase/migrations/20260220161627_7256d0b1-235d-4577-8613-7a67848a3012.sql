
-- Clean corrupted additional_images URLs in games table
-- URLs with &quot; artifacts or other junk from scraping
UPDATE public.games
SET additional_images = ARRAY(
  SELECT elem
  FROM unnest(additional_images) AS elem
  WHERE 
    elem NOT LIKE '%&quot;%'
    AND elem NOT LIKE '%;%'
    AND elem ~ '^https?://'
    AND elem ~ '\.(jpg|jpeg|png|webp|gif)|/pic'
    AND elem NOT LIKE '%__geeklistimagebar%'
    AND elem NOT LIKE '%__geeklistimage%'
    AND elem NOT LIKE '%__square%'
    AND elem NOT LIKE '%__mt%'
)
WHERE additional_images IS NOT NULL
  AND array_length(additional_images, 1) > 0;

-- Also clean any catalog additional_images (should be minimal)
UPDATE public.game_catalog
SET additional_images = ARRAY(
  SELECT elem
  FROM unnest(additional_images) AS elem
  WHERE 
    elem NOT LIKE '%&quot;%'
    AND elem NOT LIKE '%;%'
    AND elem ~ '^https?://'
)
WHERE additional_images IS NOT NULL
  AND array_length(additional_images, 1) > 0;
