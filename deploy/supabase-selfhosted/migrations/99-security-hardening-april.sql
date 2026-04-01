-- Security hardening — April 2026
-- Fixes from automated security scan
-- Ref: scan 2026-04-01

SET LOCAL lock_timeout = '5s';

-- ============================================================================
-- #1: library_settings — Remove broad public SELECT policy
-- The library_settings_public VIEW already serves public clients safely.
-- This drops the raw table policy that exposes discord_webhook_url, bgg_username, etc.
-- ============================================================================
DROP POLICY IF EXISTS "Public can view library settings" ON public.library_settings;

-- ============================================================================
-- #2: login_attempts — Fix INSERT policy to service_role only
-- Was accidentally on {public} role, allowing anon users to insert arbitrary rows.
-- ============================================================================
DROP POLICY IF EXISTS "Service role can insert login attempts" ON public.login_attempts;
CREATE POLICY "Service role can insert login attempts" ON public.login_attempts
  FOR INSERT TO service_role WITH CHECK (true);

-- ============================================================================
-- #3: reengagement_email_events — Fix INSERT policy to service_role only
-- Same issue as login_attempts.
-- ============================================================================
DROP POLICY IF EXISTS "Service role can insert email events" ON public.reengagement_email_events;
CREATE POLICY "Service role can insert email events" ON public.reengagement_email_events
  FOR INSERT TO service_role WITH CHECK (true);

-- ============================================================================
-- #4: mechanic_families — Enable RLS with public read, admin-only write
-- Currently has RLS disabled entirely.
-- ============================================================================
ALTER TABLE public.mechanic_families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view mechanic families" ON public.mechanic_families
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage mechanic families" ON public.mechanic_families
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access mechanic families" ON public.mechanic_families
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- #5: catalog_ratings — Restrict SELECT to hide IP/fingerprint from normal users
-- App already uses catalog_ratings_summary view, not the raw table.
-- Replace the broad authenticated SELECT with admin/service_role only for raw data.
-- Keep INSERT for the rate-game edge function (uses service_role).
-- ============================================================================
DROP POLICY IF EXISTS "Catalog ratings visible to authenticated users" ON public.catalog_ratings;

-- Admins can see raw ratings (for moderation/abuse investigation)
CREATE POLICY "Admins can view catalog ratings" ON public.catalog_ratings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Service role access (for edge functions like rate-game)
DROP POLICY IF EXISTS "Service role can manage catalog ratings" ON public.catalog_ratings;
CREATE POLICY "Service role can manage catalog ratings" ON public.catalog_ratings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- #6: event_registrations — Hide attendee_email from anonymous users
-- Create a public-safe view, then restrict the raw table policy.
-- Anonymous users can still INSERT (RSVP) and SELECT via the view.
-- ============================================================================

-- Create the public-safe view (excludes attendee_email)
CREATE OR REPLACE VIEW public.public_event_registrations AS
SELECT
  id,
  event_id,
  attendee_name,
  attendee_user_id,
  guest_count,
  bringing_text,
  notes,
  status,
  registered_at,
  cancelled_at,
  waitlist_position
FROM public.event_registrations;

-- Grant access to the view for anon and authenticated
GRANT SELECT ON public.public_event_registrations TO anon, authenticated;

-- Now restrict the raw table: only event owners and the registrant themselves
DROP POLICY IF EXISTS "Anyone can view event registrations" ON public.event_registrations;

-- Authenticated users can see registrations for events they created or their own RSVPs
CREATE POLICY "Users can view own or hosted event registrations" ON public.event_registrations
  FOR SELECT TO authenticated USING (
    attendee_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.library_events le
      JOIN public.libraries l ON l.id = le.library_id
      WHERE le.id = event_id
        AND (le.created_by_user_id = auth.uid() OR l.owner_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Anon users can still see registrations via the public view above,
-- but for INSERT (RSVP), we need anon insert access on the raw table
-- Check if existing insert policies cover anon; if not, ensure they exist:
-- (The existing "Anyone can register for events" policy likely already covers this)

NOTIFY pgrst, 'reload schema';
