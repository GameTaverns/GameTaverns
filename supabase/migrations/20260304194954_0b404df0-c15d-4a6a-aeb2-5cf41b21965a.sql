ALTER TABLE public.library_events
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS location_city text,
  ADD COLUMN IF NOT EXISTS location_region text,
  ADD COLUMN IF NOT EXISTS location_country text,
  ADD COLUMN IF NOT EXISTS venue_name text,
  ADD COLUMN IF NOT EXISTS max_attendees integer,
  ADD COLUMN IF NOT EXISTS entry_fee text,
  ADD COLUMN IF NOT EXISTS end_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS event_type text DEFAULT 'game_night',
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS organizer_name text,
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid;