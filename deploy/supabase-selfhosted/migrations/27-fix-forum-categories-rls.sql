-- Fix forum_categories RLS policies for self-hosted compatibility
-- Migration: 27-fix-forum-categories-rls.sql
--
-- The issue: overlapping policies with different role scopes causing conflicts
-- when library owners try to archive/update their forum categories.

-- First, drop the problematic overlapping policies
DROP POLICY IF EXISTS "Admins and moderators can create categories" ON public.forum_categories;
DROP POLICY IF EXISTS "Admins and moderators can update categories" ON public.forum_categories;
DROP POLICY IF EXISTS "Admins and moderators can delete categories" ON public.forum_categories;

-- The "Library owners can manage their categories" and "Platform admins can manage site-wide categories"
-- policies already handle management via FOR ALL, so the separate INSERT/UPDATE/DELETE policies
-- were redundant and causing conflicts.

-- However, we need to ensure moderators can also manage library categories.
-- Update the existing library owner policy to include moderators.

DROP POLICY IF EXISTS "Library owners can manage their categories" ON public.forum_categories;

CREATE POLICY "Library managers can manage their categories"
ON public.forum_categories
FOR ALL
TO authenticated
USING (
  library_id IS NOT NULL AND (
    -- Library owner
    EXISTS (SELECT 1 FROM public.libraries WHERE id = forum_categories.library_id AND owner_id = auth.uid())
    OR
    -- Library moderator
    public.is_library_moderator(auth.uid(), library_id)
  )
)
WITH CHECK (
  library_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.libraries WHERE id = forum_categories.library_id AND owner_id = auth.uid())
    OR
    public.is_library_moderator(auth.uid(), library_id)
  )
);

-- Verify policies are correctly set
DO $$
DECLARE
  policy_count integer;
BEGIN
  SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE tablename = 'forum_categories';
  RAISE NOTICE 'forum_categories now has % policies', policy_count;
END $$;
