DROP VIEW IF EXISTS public.library_directory CASCADE;

CREATE OR REPLACE VIEW public.library_directory AS
SELECT
  l.id, l.name, l.slug, l.description, l.created_at,
  ls.logo_url, ls.is_discoverable, ls.allow_lending,
  ls.location_city, ls.location_region, ls.location_country,
  ls.latitude, ls.longitude,
  (SELECT count(*) FROM games WHERE games.library_id = l.id) AS game_count,
  (SELECT count(*) FROM library_followers WHERE library_followers.library_id = l.id) AS follower_count,
  (SELECT count(*) FROM library_members WHERE library_members.library_id = l.id) AS member_count
FROM libraries l
LEFT JOIN library_settings ls ON ls.library_id = l.id
WHERE l.is_active = true AND ls.is_discoverable = true;

GRANT SELECT ON public.library_directory TO anon, authenticated;

DROP VIEW IF EXISTS public.library_calendar_events CASCADE;

CREATE OR REPLACE VIEW public.library_calendar_events AS
SELECT
  'poll'::text AS event_type,
  gp.id, gp.library_id, gp.title, gp.description,
  gp.event_date, gp.event_location,
  gp.share_token, gp.status AS poll_status, gp.created_at,
  NULL::double precision AS latitude, NULL::double precision AS longitude,
  NULL::text AS location_city, NULL::text AS location_region, NULL::text AS venue_name
FROM game_polls gp
WHERE gp.poll_type = 'game_night' AND gp.event_date IS NOT NULL
  AND gp.status = ANY (ARRAY['open','closed'])
UNION ALL
SELECT
  'standalone'::text AS event_type,
  le.id, le.library_id, le.title, le.description,
  le.event_date, le.event_location,
  NULL::text AS share_token, NULL::text AS poll_status, le.created_at,
  le.latitude, le.longitude, le.location_city, le.location_region, le.venue_name
FROM library_events le
WHERE le.status <> 'cancelled';

GRANT SELECT ON public.library_calendar_events TO anon, authenticated;