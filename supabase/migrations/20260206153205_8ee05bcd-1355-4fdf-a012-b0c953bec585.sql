-- Fix RLS policy for library_members to allow users to see their own membership
-- The current policy requires is_library_member() which creates circular dependency

-- Drop the problematic SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view library members" ON public.library_members;

-- Create two separate SELECT policies:
-- 1. Users can always see their own membership records
CREATE POLICY "Users can view their own memberships"
ON public.library_members
FOR SELECT
USING (auth.uid() = user_id);

-- 2. Members can see other members of libraries they belong to
CREATE POLICY "Members can view other library members"
ON public.library_members
FOR SELECT
USING (
  is_library_member(auth.uid(), library_id) 
  OR has_role(auth.uid(), 'admin'::app_role)
);