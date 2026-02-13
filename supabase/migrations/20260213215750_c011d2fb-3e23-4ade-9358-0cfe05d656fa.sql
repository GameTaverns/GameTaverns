
-- Fix forum_categories RLS to properly handle club-scoped categories
-- The existing "Anyone can view non-archived categories" policy matches club categories
-- (where library_id IS NULL but club_id IS NOT NULL) making them visible to everyone.

-- Drop the problematic SELECT policy
DROP POLICY IF EXISTS "Anyone can view non-archived categories" ON public.forum_categories;

-- Recreate with proper club exclusion: site-wide = library_id IS NULL AND club_id IS NULL
CREATE POLICY "Anyone can view non-archived categories"
ON public.forum_categories FOR SELECT
USING (
  is_archived = false
  AND (
    -- Site-wide categories (no library, no club)
    (library_id IS NULL AND club_id IS NULL)
    OR
    -- Library categories require membership
    (library_id IS NOT NULL AND is_library_member(auth.uid(), library_id))
    OR
    -- Club categories require club membership
    (club_id IS NOT NULL AND is_club_member(auth.uid(), club_id))
  )
);

-- Club owners can manage (CRUD) club forum categories
CREATE POLICY "Club owners can manage club forum categories"
ON public.forum_categories FOR ALL
USING (
  club_id IS NOT NULL AND is_club_owner(auth.uid(), club_id)
)
WITH CHECK (
  club_id IS NOT NULL AND is_club_owner(auth.uid(), club_id)
);

-- Admins can also manage club categories (already covered by "Platform admins can manage site-wide categories"
-- but that only handles library_id IS NULL, which would match club categories too - let's be explicit)
-- Actually the existing admin policy checks library_id IS NULL which WOULD match club categories.
-- Let's update it to be truly site-wide only, and add a separate admin policy for clubs.

DROP POLICY IF EXISTS "Platform admins can manage site-wide categories" ON public.forum_categories;

CREATE POLICY "Platform admins can manage site-wide categories"
ON public.forum_categories FOR ALL
USING (
  library_id IS NULL AND club_id IS NULL AND has_role(auth.uid(), 'admin')
)
WITH CHECK (
  library_id IS NULL AND club_id IS NULL AND has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can manage club forum categories"
ON public.forum_categories FOR ALL
USING (
  club_id IS NOT NULL AND has_role(auth.uid(), 'admin')
)
WITH CHECK (
  club_id IS NOT NULL AND has_role(auth.uid(), 'admin')
);
