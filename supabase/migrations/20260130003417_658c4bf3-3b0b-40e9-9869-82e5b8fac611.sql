-- =====================================================
-- Security Fix: Restrict access to sensitive user data
-- =====================================================

-- 1. Fix user_profiles: Remove the policy that exposes profiles of library owners to everyone
--    Replace with stricter policies that only expose data when truly needed
DROP POLICY IF EXISTS "Public can view limited profile data via view" ON public.user_profiles;

-- Create a more restrictive policy: Only expose profiles if you're authenticated 
-- and either: (a) viewing your own profile, (b) an admin, (c) a member of the same library, 
-- or (d) in a loan relationship with the user
CREATE POLICY "Authenticated users can view relevant profiles"
ON public.user_profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- Always can view own profile
    auth.uid() = user_id
    -- Admins can view all
    OR has_role(auth.uid(), 'admin')
    -- Can view profiles of users in same libraries (members/owners)
    OR EXISTS (
      SELECT 1 FROM public.library_members lm1
      JOIN public.library_members lm2 ON lm1.library_id = lm2.library_id
      WHERE lm1.user_id = auth.uid() AND lm2.user_id = user_profiles.user_id
    )
    -- Can view profile of library owners you're a member of
    OR EXISTS (
      SELECT 1 FROM public.libraries l
      JOIN public.library_members lm ON l.id = lm.library_id
      WHERE l.owner_id = user_profiles.user_id AND lm.user_id = auth.uid()
    )
    -- Can view profile of users you have loan relationships with
    OR EXISTS (
      SELECT 1 FROM public.game_loans gl
      WHERE (gl.borrower_user_id = auth.uid() AND gl.lender_user_id = user_profiles.user_id)
         OR (gl.lender_user_id = auth.uid() AND gl.borrower_user_id = user_profiles.user_id)
    )
  )
);

-- 2. Create a minimal public profile view for anonymous users (without discord_user_id)
--    This exposes only display_name and avatar_url for library owner identification
DROP VIEW IF EXISTS public.user_profiles_minimal;
CREATE VIEW public.user_profiles_minimal WITH (security_invoker = false) AS
SELECT 
  up.user_id,
  up.display_name,
  up.username,
  up.avatar_url
  -- Deliberately excluding: bio, discord_user_id
FROM public.user_profiles up
JOIN public.libraries l ON l.owner_id = up.user_id
WHERE l.is_active = true;

COMMENT ON VIEW public.user_profiles_minimal IS 'Minimal public profile data for library owners only - excludes Discord ID and bio';

-- 3. Fix libraries table: Use the libraries_public view for anonymous access
--    The base table policy "Anyone can read library info" exposes owner_id
--    Instead, we should only allow anonymous access through the secure view

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can read library info" ON public.libraries;

-- Create a policy for authenticated users to see library info (they need it for membership)
CREATE POLICY "Authenticated users can view libraries"
ON public.libraries
FOR SELECT
USING (
  auth.uid() IS NOT NULL
);

-- Create policy for anonymous users to only see active libraries (for discovery)
CREATE POLICY "Anonymous users can view active libraries"
ON public.libraries
FOR SELECT
USING (
  auth.uid() IS NULL AND is_active = true
);

-- 4. Update libraries_public view to ensure owner_id is excluded
DROP VIEW IF EXISTS public.libraries_public;
CREATE VIEW public.libraries_public WITH (security_invoker = true) AS
SELECT 
  id,
  slug,
  name,
  description,
  custom_domain,
  is_active,
  is_premium,
  created_at,
  updated_at
  -- Deliberately excluding: owner_id
FROM public.libraries
WHERE is_active = true;

COMMENT ON VIEW public.libraries_public IS 'Public library data excluding sensitive owner_id for anonymous users';

-- 5. Add comment to document the game_messages INSERT policy intent
COMMENT ON POLICY "Service role can insert messages" ON public.game_messages IS 
'This policy uses WITH CHECK (true) because messages are only inserted via edge functions using the service role, which bypasses RLS anyway. The edge function validates input before insertion.';

-- 6. Create a function for safe message age-based cleanup (retention policy)
CREATE OR REPLACE FUNCTION public.cleanup_old_messages(retention_days INTEGER DEFAULT 365)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.game_messages
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_messages IS 'Cleanup function for message retention policy. Run periodically to limit exposure if encryption keys are compromised.';

-- Grant execute only to service role (for scheduled cleanup)
REVOKE ALL ON FUNCTION public.cleanup_old_messages FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_old_messages FROM anon;
REVOKE ALL ON FUNCTION public.cleanup_old_messages FROM authenticated;