-- Fix library_members public exposure security issue
-- Replace overly permissive "Anyone can view library members" policy

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Anyone can view library members" ON public.library_members;

-- Create a more restrictive policy that only allows:
-- 1. Authenticated users can see members of libraries they belong to or follow
-- 2. Admins can see all
-- 3. Library owners can see their members (already covered by "Library owners can manage members")
CREATE POLICY "Authenticated users can view library members" 
ON public.library_members 
FOR SELECT 
TO authenticated
USING (
  -- Users can see members of libraries they're part of
  is_library_member(auth.uid(), library_id)
  -- Or if they're an admin
  OR has_role(auth.uid(), 'admin')
);

-- Create a public view that only exposes member counts (not user_ids)
-- This already exists as library_members_public which just shows counts
-- Verify it doesn't expose user_ids

-- For the game_ratings table, create a sanitized view that strips tracking data
-- to prevent cross-library correlation while maintaining functionality
CREATE OR REPLACE VIEW public.game_ratings_library_view 
WITH (security_invoker = true)
AS
SELECT 
  id,
  game_id,
  guest_identifier, -- Only visible to library owner via RLS
  rating,
  created_at,
  updated_at
  -- Excluded: ip_address, device_fingerprint (sensitive tracking data)
FROM public.game_ratings;