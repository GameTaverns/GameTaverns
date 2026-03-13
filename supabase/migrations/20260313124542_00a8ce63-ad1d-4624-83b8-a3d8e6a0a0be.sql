CREATE OR REPLACE VIEW public.public_event_directory
WITH (security_invoker = on) AS
SELECT
  le.id,
  le.title,
  le.description,
  le.event_date,
  le.end_date,
  le.event_location,
  le.event_type,
  le.is_public,
  le.max_attendees,
  le.venue_name,
  le.location_city,
  le.location_region,
  le.location_country,
  le.latitude,
  le.longitude,
  le.library_id,
  le.created_by_user_id,
  le.created_at,
  le.status,
  le.entry_fee,
  le.organizer_name,
  up.display_name AS creator_display_name,
  up.avatar_url AS creator_avatar,
  l.name AS library_name,
  l.slug AS library_slug
FROM library_events le
LEFT JOIN user_profiles up ON up.user_id = le.created_by_user_id
LEFT JOIN libraries l ON l.id = le.library_id
WHERE le.status != 'cancelled'
  AND le.is_public = true
  AND le.event_date >= (now() - interval '1 day')
ORDER BY le.event_date ASC;