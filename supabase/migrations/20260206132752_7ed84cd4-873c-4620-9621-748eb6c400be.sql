-- Fix 1: Add public SELECT policy for library_settings so visitors can see feature flags
-- This is required for feature flag visibility on tenant sites
CREATE POLICY "Public can view library settings" 
ON public.library_settings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM libraries 
    WHERE libraries.id = library_settings.library_id 
    AND libraries.is_active = true
  )
);

-- Fix 2: Ensure library_members count query works for non-members
-- The current SELECT policy requires being a member, but we need count for join buttons
-- Add a policy allowing anyone to count members of active libraries
CREATE POLICY "Public can count members of active libraries"
ON public.library_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM libraries
    WHERE libraries.id = library_members.library_id
    AND libraries.is_active = true
  )
);