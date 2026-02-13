-- =============================================================================
-- GameTaverns Self-Hosted: Club Forum RLS Fix
-- Version: 2.5.1
-- =============================================================================
-- Fix forum_categories RLS to properly handle club-scoped categories.
-- The existing "Anyone can view non-archived categories" policy matches club
-- categories (where library_id IS NULL but club_id IS NOT NULL) making them
-- visible to everyone. This migration fixes that.

-- Drop the problematic SELECT policy
DROP POLICY IF EXISTS "Anyone can view non-archived categories" ON public.forum_categories;

-- Recreate with proper club handling
CREATE POLICY "Anyone can view non-archived categories"
ON public.forum_categories FOR SELECT
USING (
  is_archived = false
  AND (
    (library_id IS NULL AND club_id IS NULL)
    OR
    (library_id IS NOT NULL AND is_library_member(auth.uid(), library_id))
    OR
    (club_id IS NOT NULL AND is_club_member(auth.uid(), club_id))
  )
);

-- Club owners can manage club forum categories (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'forum_categories'
      AND policyname = 'Club owners can manage club forum categories'
  ) THEN
    CREATE POLICY "Club owners can manage club forum categories"
    ON public.forum_categories FOR ALL
    USING (club_id IS NOT NULL AND is_club_owner(auth.uid(), club_id))
    WITH CHECK (club_id IS NOT NULL AND is_club_owner(auth.uid(), club_id));
  END IF;
END $$;

-- Fix admin policy to be truly site-wide only
DROP POLICY IF EXISTS "Platform admins can manage site-wide categories" ON public.forum_categories;

CREATE POLICY "Platform admins can manage site-wide categories"
ON public.forum_categories FOR ALL
USING (
  library_id IS NULL AND club_id IS NULL AND has_role(auth.uid(), 'admin')
)
WITH CHECK (
  library_id IS NULL AND club_id IS NULL AND has_role(auth.uid(), 'admin')
);

-- Admins can also manage club forum categories (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'forum_categories'
      AND policyname = 'Admins can manage club forum categories'
  ) THEN
    CREATE POLICY "Admins can manage club forum categories"
    ON public.forum_categories FOR ALL
    USING (club_id IS NOT NULL AND has_role(auth.uid(), 'admin'))
    WITH CHECK (club_id IS NOT NULL AND has_role(auth.uid(), 'admin'));
  END IF;
END $$;
