-- =============================================================================
-- Security Fixes for borrower_ratings, game_messages, and library_followers
-- =============================================================================

-- =============================================================================
-- FIX 1: borrower_ratings - Restrict public access to user IDs
-- Replace overly permissive SELECT policy with relationship-based access
-- =============================================================================

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Anyone can view borrower ratings" ON public.borrower_ratings;

-- Create new policy: Only users involved in the loan or library owners/admins can view
CREATE POLICY "Users can view ratings for their loans"
ON public.borrower_ratings
FOR SELECT
USING (
  -- User is the rater
  auth.uid() = rated_by_user_id
  OR
  -- User is the rated person
  auth.uid() = rated_user_id
  OR
  -- User is a library owner for the loan's library
  EXISTS (
    SELECT 1 FROM public.game_loans gl
    JOIN public.libraries l ON l.id = gl.library_id
    WHERE gl.id = borrower_ratings.loan_id
    AND l.owner_id = auth.uid()
  )
  OR
  -- User is an admin
  public.has_role(auth.uid(), 'admin')
);

-- =============================================================================
-- FIX 2: game_messages - The existing policies are already properly restrictive
-- The finding mentions service role access, but service role ALWAYS bypasses RLS
-- This is by design in Supabase. We can add audit logging but cannot restrict service role.
-- The current policies are actually correct:
--   - Admins can view/update/delete
--   - Library owners can view/update/delete their game messages
--   - Service role INSERT is for edge functions (expected behavior)
-- No changes needed - this is a false positive. Service role bypass is by design.
-- =============================================================================

-- =============================================================================
-- FIX 3: library_followers - Add unique constraint to prevent duplicate follows
-- and add a trigger for basic rate limiting
-- =============================================================================

-- First, add unique constraint if not exists (prevents duplicate follows at DB level)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'library_followers_user_library_unique'
  ) THEN
    ALTER TABLE public.library_followers 
    ADD CONSTRAINT library_followers_user_library_unique 
    UNIQUE (follower_user_id, library_id);
  END IF;
END $$;

-- Create a rate limiting function for follows
CREATE OR REPLACE FUNCTION public.check_follow_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_follow_count INTEGER;
BEGIN
  -- Count follows by this user in the last minute
  SELECT COUNT(*) INTO recent_follow_count
  FROM public.library_followers
  WHERE follower_user_id = NEW.follower_user_id
  AND followed_at > NOW() - INTERVAL '1 minute';
  
  -- Allow maximum 10 follows per minute
  IF recent_follow_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before following more libraries.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for rate limiting (drop first if exists)
DROP TRIGGER IF EXISTS check_follow_rate_limit_trigger ON public.library_followers;

CREATE TRIGGER check_follow_rate_limit_trigger
BEFORE INSERT ON public.library_followers
FOR EACH ROW
EXECUTE FUNCTION public.check_follow_rate_limit();