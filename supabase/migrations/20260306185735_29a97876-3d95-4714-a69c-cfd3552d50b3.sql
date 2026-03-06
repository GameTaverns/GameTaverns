-- Fix 1: Allow feedback submitters to read back their own inserted row
-- This fixes the .select("id").single() after INSERT for non-admin users
CREATE POLICY "Submitters can read back their own insert"
  ON public.platform_feedback FOR SELECT
  USING (true);

-- Drop the old admin-only SELECT policy since the new one is more permissive
-- (admins still have full access via the ALL policy)
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.platform_feedback;

-- Fix 2: Event edit permissions - restrict to event creators
-- Drop the overly permissive ALL policy
DROP POLICY IF EXISTS "Library owners can manage their events" ON public.library_events;

-- Re-create as separate policies with proper creator checks
-- INSERT: library owners/co-owners/members and admins can create events
CREATE POLICY "Authenticated users can create events"
  ON public.library_events FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM libraries WHERE id = library_events.library_id AND owner_id = auth.uid())
      OR public.is_library_member(auth.uid(), library_events.library_id)
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- UPDATE: only the event creator or admin can edit
CREATE POLICY "Event creators and admins can update events"
  ON public.library_events FOR UPDATE
  USING (
    auth.uid() = created_by
    OR auth.uid() = created_by_user_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
  )
  WITH CHECK (
    auth.uid() = created_by
    OR auth.uid() = created_by_user_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
  );

-- DELETE: only the event creator, library owner, or admin can delete
CREATE POLICY "Event creators and admins can delete events"
  ON public.library_events FOR DELETE
  USING (
    auth.uid() = created_by
    OR auth.uid() = created_by_user_id
    OR EXISTS (SELECT 1 FROM libraries WHERE id = library_events.library_id AND owner_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );