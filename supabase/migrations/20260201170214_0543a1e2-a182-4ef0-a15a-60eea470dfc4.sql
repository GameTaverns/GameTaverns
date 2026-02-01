-- Drop and recreate the library_directory view to filter by is_discoverable
DROP VIEW IF EXISTS public.library_directory;

CREATE VIEW public.library_directory
WITH (security_invoker = on) AS
SELECT 
    l.id,
    l.name,
    l.slug,
    l.description,
    l.created_at,
    ls.logo_url,
    ls.is_discoverable,
    ls.allow_lending,
    (SELECT count(*) FROM games WHERE games.library_id = l.id) AS game_count,
    (SELECT count(*) FROM library_followers WHERE library_followers.library_id = l.id) AS follower_count,
    (SELECT count(*) FROM library_members WHERE library_members.library_id = l.id) AS member_count
FROM libraries l
LEFT JOIN library_settings ls ON ls.library_id = l.id
WHERE l.is_active = true 
  AND ls.is_discoverable = true;