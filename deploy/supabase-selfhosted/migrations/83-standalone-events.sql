-- =============================================================================
-- Migration 83: Standalone (non-library) Events & Location Discovery
-- =============================================================================

SET LOCAL lock_timeout = '5s';

-- -----------------------------------------------
-- 1. Make library_id nullable, add owner + location fields
-- -----------------------------------------------
ALTER TABLE public.library_events
  ALTER COLUMN library_id DROP NOT NULL;

ALTER TABLE public.library_events
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID,
  ADD COLUMN IF NOT EXISTS location_city TEXT,
  ADD COLUMN IF NOT EXISTS location_region TEXT,
  ADD COLUMN IF NOT EXISTS location_country TEXT;

CREATE INDEX IF NOT EXISTS idx_library_events_creator ON public.library_events(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_library_events_city ON public.library_events(location_city);

-- -----------------------------------------------
-- 2. Helper: can the user manage this event?
-- -----------------------------------------------
DROP FUNCTION IF EXISTS public.can_manage_event(UUID, UUID);
CREATE OR REPLACE FUNCTION public.can_manage_event(_user_id UUID, _event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_events le
    WHERE le.id = _event_id
    AND (
      -- creator of standalone event
      le.created_by_user_id = _user_id
      -- library owner / co-owner
      OR (le.library_id IS NOT NULL AND (
        EXISTS (SELECT 1 FROM public.libraries l WHERE l.id = le.library_id AND l.owner_id = _user_id)
        OR public.is_library_co_owner(_user_id, le.library_id)
      ))
    )
  )
$$;

-- -----------------------------------------------
-- 3. Update library_events RLS for standalone events
-- -----------------------------------------------

-- SELECT: public events are visible; library events follow library visibility
DROP POLICY IF EXISTS "Events are viewable by library members" ON public.library_events;
DROP POLICY IF EXISTS "Events viewable" ON public.library_events;
CREATE POLICY "Events viewable" ON public.library_events
  FOR SELECT USING (
    -- standalone public events
    (library_id IS NULL AND is_public = true AND status = 'published')
    -- standalone events by creator (any status)
    OR (library_id IS NULL AND created_by_user_id = auth.uid())
    -- library events: library must be active
    OR (library_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.libraries l WHERE l.id = library_id AND l.is_active = true
    ))
  );

-- INSERT: authenticated users can create standalone; library owners for library events
DROP POLICY IF EXISTS "Library owners can create events" ON public.library_events;
DROP POLICY IF EXISTS "Users can create events" ON public.library_events;
CREATE POLICY "Users can create events" ON public.library_events
  FOR INSERT WITH CHECK (
    -- standalone event: must be logged in and set as creator
    (library_id IS NULL AND created_by_user_id = auth.uid())
    -- library event: must be owner/co-owner
    OR (library_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM public.libraries l WHERE l.id = library_id AND l.owner_id = auth.uid())
      OR public.is_library_co_owner(auth.uid(), library_id)
    ))
  );

-- UPDATE/DELETE: use can_manage_event helper
DROP POLICY IF EXISTS "Library owners can update events" ON public.library_events;
DROP POLICY IF EXISTS "Event managers can update" ON public.library_events;
CREATE POLICY "Event managers can update" ON public.library_events
  FOR UPDATE USING (public.can_manage_event(auth.uid(), id));

DROP POLICY IF EXISTS "Library owners can delete events" ON public.library_events;
DROP POLICY IF EXISTS "Event managers can delete" ON public.library_events;
CREATE POLICY "Event managers can delete" ON public.library_events
  FOR DELETE USING (public.can_manage_event(auth.uid(), id));

-- -----------------------------------------------
-- 4. Update child-table RLS to support standalone events
--    Pattern: public read if event is visible; manage if can_manage_event
-- -----------------------------------------------

-- Helper for child table SELECT: is the parent event visible?
DROP FUNCTION IF EXISTS public.is_event_visible(UUID);
CREATE OR REPLACE FUNCTION public.is_event_visible(_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_events le
    WHERE le.id = _event_id
    AND (
      (le.library_id IS NULL AND le.is_public = true AND le.status = 'published')
      OR (le.library_id IS NULL AND le.created_by_user_id = auth.uid())
      OR (le.library_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.libraries l WHERE l.id = le.library_id AND l.is_active = true
      ))
    )
  )
$$;

-- event_registrations
DROP POLICY IF EXISTS "Public can view event registrations" ON public.event_registrations;
CREATE POLICY "Public can view event registrations" ON public.event_registrations
  FOR SELECT USING (public.is_event_visible(event_id));

DROP POLICY IF EXISTS "Anyone can register for events" ON public.event_registrations;
CREATE POLICY "Anyone can register for events" ON public.event_registrations
  FOR INSERT WITH CHECK (public.is_event_visible(event_id));

DROP POLICY IF EXISTS "Users can cancel own registration" ON public.event_registrations;
CREATE POLICY "Users can cancel own registration" ON public.event_registrations
  FOR UPDATE USING (
    attendee_user_id = auth.uid() OR public.can_manage_event(auth.uid(), event_id)
  );

DROP POLICY IF EXISTS "Library owners can manage registrations" ON public.event_registrations;
CREATE POLICY "Event managers can delete registrations" ON public.event_registrations
  FOR DELETE USING (public.can_manage_event(auth.uid(), event_id));

-- event_tournament_config
DROP POLICY IF EXISTS "Public can view tournament config" ON public.event_tournament_config;
CREATE POLICY "Public can view tournament config" ON public.event_tournament_config
  FOR SELECT USING (public.is_event_visible(event_id));

DROP POLICY IF EXISTS "Library owners can manage tournament config" ON public.event_tournament_config;
CREATE POLICY "Event managers can manage tournament config" ON public.event_tournament_config
  FOR ALL USING (public.can_manage_event(auth.uid(), event_id))
  WITH CHECK (public.can_manage_event(auth.uid(), event_id));

-- event_tournament_players
DROP POLICY IF EXISTS "Public can view tournament players" ON public.event_tournament_players;
CREATE POLICY "Public can view tournament players" ON public.event_tournament_players
  FOR SELECT USING (public.is_event_visible(event_id));

DROP POLICY IF EXISTS "Library owners can manage tournament players" ON public.event_tournament_players;
CREATE POLICY "Event managers can manage tournament players" ON public.event_tournament_players
  FOR ALL USING (public.can_manage_event(auth.uid(), event_id))
  WITH CHECK (public.can_manage_event(auth.uid(), event_id));

-- event_tournament_matches
DROP POLICY IF EXISTS "Public can view tournament matches" ON public.event_tournament_matches;
CREATE POLICY "Public can view tournament matches" ON public.event_tournament_matches
  FOR SELECT USING (public.is_event_visible(event_id));

DROP POLICY IF EXISTS "Library owners can manage tournament matches" ON public.event_tournament_matches;
CREATE POLICY "Event managers can manage tournament matches" ON public.event_tournament_matches
  FOR ALL USING (public.can_manage_event(auth.uid(), event_id))
  WITH CHECK (public.can_manage_event(auth.uid(), event_id));

-- event_schedule_blocks
DROP POLICY IF EXISTS "Public can view schedule blocks" ON public.event_schedule_blocks;
CREATE POLICY "Public can view schedule blocks" ON public.event_schedule_blocks
  FOR SELECT USING (public.is_event_visible(event_id));

DROP POLICY IF EXISTS "Library owners can manage schedule blocks" ON public.event_schedule_blocks;
CREATE POLICY "Event managers can manage schedule blocks" ON public.event_schedule_blocks
  FOR ALL USING (public.can_manage_event(auth.uid(), event_id))
  WITH CHECK (public.can_manage_event(auth.uid(), event_id));

-- -----------------------------------------------
-- 5. Update public event directory view
-- -----------------------------------------------
DROP VIEW IF EXISTS public.public_event_directory CASCADE;
CREATE VIEW public.public_event_directory
WITH (security_invoker = false)
AS
SELECT
    le.id,
    le.library_id,
    le.created_by_user_id,
    le.title,
    le.description,
    le.event_date,
    le.end_date,
    le.event_type,
    le.event_location,
    le.venue_name,
    le.venue_address,
    le.max_attendees,
    le.entry_fee,
    le.age_restriction,
    le.status,
    le.location_city,
    le.location_region,
    le.location_country,
    COALESCE(l.name, up.display_name, 'Community Event') as organizer_name,
    l.slug as library_slug,
    l.logo_url as library_logo,
    le.created_at,
    (SELECT COUNT(*)::INTEGER FROM public.event_registrations er WHERE er.event_id = le.id AND er.status = 'registered') as registration_count
FROM public.library_events le
LEFT JOIN public.libraries l ON l.id = le.library_id
LEFT JOIN public.user_profiles up ON up.user_id = le.created_by_user_id
WHERE le.is_public = true
  AND le.status = 'published'
  AND (l.is_active = true OR le.library_id IS NULL)
  AND le.event_date >= (now() - interval '1 day');

NOTIFY pgrst, 'reload schema';
