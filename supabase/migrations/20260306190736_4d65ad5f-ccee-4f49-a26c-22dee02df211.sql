-- Recreate the library_calendar_events view to include creator columns
CREATE OR REPLACE VIEW public.library_calendar_events AS
SELECT 'poll'::text AS event_type,
    gp.id,
    gp.library_id,
    gp.title,
    gp.description,
    gp.event_date,
    gp.event_location,
    gp.share_token,
    gp.status AS poll_status,
    gp.created_at,
    NULL::double precision AS latitude,
    NULL::double precision AS longitude,
    NULL::text AS location_city,
    NULL::text AS location_region,
    NULL::text AS venue_name,
    gp.created_by::text AS created_by,
    NULL::text AS created_by_user_id
   FROM game_polls gp
  WHERE gp.poll_type = 'game_night'::text AND gp.event_date IS NOT NULL AND (gp.status = ANY (ARRAY['open'::text, 'closed'::text]))
UNION ALL
 SELECT 'standalone'::text AS event_type,
    le.id,
    le.library_id,
    le.title,
    le.description,
    le.event_date,
    le.event_location,
    NULL::text AS share_token,
    NULL::text AS poll_status,
    le.created_at,
    le.latitude,
    le.longitude,
    le.location_city,
    le.location_region,
    le.venue_name,
    le.created_by::text AS created_by,
    le.created_by_user_id::text AS created_by_user_id
   FROM library_events le
  WHERE le.status <> 'cancelled'::text;