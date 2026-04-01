-- =============================================================================
-- GameTaverns Self-Hosted: Security Hardening
-- Fixes RLS holes: event PII, notification log, library settings webhooks,
-- wishlist, catalog ratings PII, mechanic_families, event mgmt tables,
-- storage buckets
-- =============================================================================

-- 1. EVENT REGISTRATIONS: Remove public SELECT exposing PII
DROP POLICY IF EXISTS "Anyone can view event registrations" ON public.event_registrations;

CREATE POLICY "Event organizers and attendees can view registrations"
ON public.event_registrations FOR SELECT
TO authenticated
USING (
  attendee_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM library_events le
    JOIN libraries l ON l.id = le.library_id
    WHERE le.id = event_registrations.event_id
    AND (le.created_by = auth.uid() OR l.owner_id = auth.uid())
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Service role full access to event registrations"
ON public.event_registrations FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 2. NOTIFICATION LOG: Fix INSERT from public to service_role
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notification_log;

CREATE POLICY "Service role can insert notifications"
ON public.notification_log FOR INSERT
TO service_role
WITH CHECK (true);

-- 3. LIBRARY SETTINGS: Remove public SELECT exposing webhooks/contact info
DROP POLICY IF EXISTS "Public can view library settings" ON public.library_settings;

-- 4. GAME WISHLIST: Fix policies that apply to public instead of service_role
DROP POLICY IF EXISTS "Service role can delete wishlist entries" ON public.game_wishlist;
DROP POLICY IF EXISTS "Service role can insert wishlist entries" ON public.game_wishlist;

CREATE POLICY "Service role can delete wishlist entries"
ON public.game_wishlist FOR DELETE
TO service_role
USING (true);

CREATE POLICY "Service role can insert wishlist entries"
ON public.game_wishlist FOR INSERT
TO service_role
WITH CHECK (true);

-- 5. CATALOG RATINGS: Restrict full table to admins (has IP/fingerprint)
DROP POLICY IF EXISTS "Catalog ratings visible to authenticated users" ON public.catalog_ratings;

CREATE POLICY "Catalog ratings visible to admins"
ON public.catalog_ratings FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role full access to catalog ratings"
ON public.catalog_ratings FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 6. MECHANIC FAMILIES: Enable RLS, public read, admin write
ALTER TABLE public.mechanic_families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read mechanic families"
ON public.mechanic_families FOR SELECT
USING (true);

CREATE POLICY "Admins can manage mechanic families"
ON public.mechanic_families FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 7. EVENT MANAGEMENT TABLES: Restrict writes to organizers/owners

-- event_supplies
DROP POLICY IF EXISTS "Authenticated users can manage event supplies" ON public.event_supplies;

CREATE POLICY "Event organizers can manage supplies"
ON public.event_supplies FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM library_events le
    JOIN libraries l ON l.id = le.library_id
    WHERE le.id = event_supplies.event_id
    AND (le.created_by = auth.uid() OR l.owner_id = auth.uid())
  )
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM library_events le
    JOIN libraries l ON l.id = le.library_id
    WHERE le.id = event_supplies.event_id
    AND (le.created_by = auth.uid() OR l.owner_id = auth.uid())
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Authenticated users can view event supplies"
ON public.event_supplies FOR SELECT
TO authenticated
USING (true);

-- event_tables
DROP POLICY IF EXISTS "Authenticated users can manage event tables" ON public.event_tables;

CREATE POLICY "Event organizers can manage tables"
ON public.event_tables FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM library_events le
    JOIN libraries l ON l.id = le.library_id
    WHERE le.id = event_tables.event_id
    AND (le.created_by = auth.uid() OR l.owner_id = auth.uid())
  )
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM library_events le
    JOIN libraries l ON l.id = le.library_id
    WHERE le.id = event_tables.event_id
    AND (le.created_by = auth.uid() OR l.owner_id = auth.uid())
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Authenticated users can view event tables"
ON public.event_tables FOR SELECT
TO authenticated
USING (true);

-- event_table_seats
DROP POLICY IF EXISTS "Authenticated users can manage event table seats" ON public.event_table_seats;

CREATE POLICY "Event organizers can manage table seats"
ON public.event_table_seats FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM event_tables et
    JOIN library_events le ON le.id = et.event_id
    JOIN libraries l ON l.id = le.library_id
    WHERE et.id = event_table_seats.table_id
    AND (le.created_by = auth.uid() OR l.owner_id = auth.uid())
  )
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM event_tables et
    JOIN library_events le ON le.id = et.event_id
    JOIN libraries l ON l.id = le.library_id
    WHERE et.id = event_table_seats.table_id
    AND (le.created_by = auth.uid() OR l.owner_id = auth.uid())
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Authenticated users can view table seats"
ON public.event_table_seats FOR SELECT
TO authenticated
USING (true);

-- event_games
DROP POLICY IF EXISTS "Authenticated users can manage event games" ON public.event_games;

CREATE POLICY "Event organizers can manage event games"
ON public.event_games FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM library_events le
    JOIN libraries l ON l.id = le.library_id
    WHERE le.id = event_games.event_id
    AND (le.created_by = auth.uid() OR l.owner_id = auth.uid())
  )
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM library_events le
    JOIN libraries l ON l.id = le.library_id
    WHERE le.id = event_games.event_id
    AND (le.created_by = auth.uid() OR l.owner_id = auth.uid())
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- event_attendee_prefs
DROP POLICY IF EXISTS "Authenticated users can manage event attendee prefs" ON public.event_attendee_prefs;

CREATE POLICY "Event organizers can manage attendee prefs"
ON public.event_attendee_prefs FOR ALL
TO authenticated
USING (
  attendee_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM library_events le
    JOIN libraries l ON l.id = le.library_id
    WHERE le.id = event_attendee_prefs.event_id
    AND (le.created_by = auth.uid() OR l.owner_id = auth.uid())
  )
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  attendee_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM library_events le
    JOIN libraries l ON l.id = le.library_id
    WHERE le.id = event_attendee_prefs.event_id
    AND (le.created_by = auth.uid() OR l.owner_id = auth.uid())
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Authenticated users can view attendee prefs"
ON public.event_attendee_prefs FOR SELECT
TO authenticated
USING (true);

-- 8. STORAGE: Feedback attachments
DROP POLICY IF EXISTS "Anyone can read feedback attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload feedback attachments" ON storage.objects;

CREATE POLICY "Authenticated users can upload feedback attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'feedback-attachments');

CREATE POLICY "Admins can read feedback attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'feedback-attachments' AND has_role(auth.uid(), 'admin'::app_role));

-- 9. STORAGE: User photos — enforce path scoping
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;

CREATE POLICY "Authenticated users can upload own photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-photos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Service role full access for event tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'event_supplies', 'event_tables', 'event_table_seats',
    'event_games', 'event_attendee_prefs'
  ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "Service role full access %s" ON public.%I', tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "Service role full access %s" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
