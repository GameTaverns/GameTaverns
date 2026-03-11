
-- FIX 2: library_directory — drop and recreate with rounded coords
DROP VIEW IF EXISTS public.library_directory;
CREATE VIEW public.library_directory AS
SELECT
  l.id,
  l.name,
  l.slug,
  l.description,
  l.created_at,
  ls.logo_url,
  ls.is_discoverable,
  ls.allow_lending,
  ls.location_city,
  ls.location_region,
  ls.location_country,
  ROUND(ls.latitude::numeric, 1)::double precision AS latitude,
  ROUND(ls.longitude::numeric, 1)::double precision AS longitude,
  (SELECT count(*) FROM games WHERE games.library_id = l.id) AS game_count,
  (SELECT count(*) FROM library_followers WHERE library_followers.library_id = l.id) AS follower_count,
  (SELECT count(*) FROM library_members WHERE library_members.library_id = l.id) AS member_count
FROM libraries l
LEFT JOIN library_settings ls ON ls.library_id = l.id
WHERE l.is_active = true AND ls.is_discoverable = true;

-- Grant access to the recreated view
GRANT SELECT ON public.library_directory TO anon, authenticated;
