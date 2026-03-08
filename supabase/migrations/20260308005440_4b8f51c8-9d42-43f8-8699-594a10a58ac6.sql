
-- Fix HTML entities in existing game titles
UPDATE public.games
SET title = REPLACE(
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(title, '&amp;', '&'),
          '&#039;', ''''),
        '&apos;', ''''),
      '&#39;', ''''),
    '&quot;', '"'),
  '&lt;', '<')
WHERE title LIKE '%&amp;%'
   OR title LIKE '%&#039;%'
   OR title LIKE '%&apos;%'
   OR title LIKE '%&#39;%'
   OR title LIKE '%&quot;%'
   OR title LIKE '%&lt;%';

-- Also fix game_catalog titles
UPDATE public.game_catalog
SET title = REPLACE(
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(title, '&amp;', '&'),
          '&#039;', ''''),
        '&apos;', ''''),
      '&#39;', ''''),
    '&quot;', '"'),
  '&lt;', '<')
WHERE title LIKE '%&amp;%'
   OR title LIKE '%&#039;%'
   OR title LIKE '%&apos;%'
   OR title LIKE '%&#39;%'
   OR title LIKE '%&quot;%'
   OR title LIKE '%&lt;%';

-- Remove exact duplicates created by the ampersand double-import
-- Keep the one with more data (has bgg_id, or image, or was created first)
DELETE FROM public.games g1
USING public.games g2
WHERE g1.library_id = g2.library_id
  AND g1.title = g2.title
  AND g1.id > g2.id
  AND g1.created_at >= g2.created_at;
