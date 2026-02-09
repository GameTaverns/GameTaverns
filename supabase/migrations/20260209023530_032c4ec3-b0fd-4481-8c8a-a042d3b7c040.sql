-- Fix forum_categories RLS policies to allow INSERT (previous ALL policy used can_manage_forum_category(id) which fails on INSERT)

-- Ensure RLS enabled
ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;

-- Drop the overly-broad ALL policy if present
DROP POLICY IF EXISTS "Admins and moderators can manage categories" ON public.forum_categories;

-- Keep/replace SELECT policy
DROP POLICY IF EXISTS "Anyone can view non-archived categories" ON public.forum_categories;
CREATE POLICY "Anyone can view non-archived categories"
ON public.forum_categories
FOR SELECT
USING (
  is_archived = false
  AND (
    library_id IS NULL
    OR public.is_library_member(auth.uid(), library_id)
  )
);

-- INSERT policy
DROP POLICY IF EXISTS "Admins and moderators can create categories" ON public.forum_categories;
CREATE POLICY "Admins and moderators can create categories"
ON public.forum_categories
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    (library_id IS NULL AND public.has_role(auth.uid(), 'admin'))
    OR
    (library_id IS NOT NULL AND (
      public.is_library_moderator(auth.uid(), library_id)
      OR EXISTS (
        SELECT 1 FROM public.libraries l
        WHERE l.id = library_id AND l.owner_id = auth.uid()
      )
    ))
  )
);

-- UPDATE policy
DROP POLICY IF EXISTS "Admins and moderators can update categories" ON public.forum_categories;
CREATE POLICY "Admins and moderators can update categories"
ON public.forum_categories
FOR UPDATE
USING (
  public.can_manage_forum_category(auth.uid(), id)
)
WITH CHECK (
  public.can_manage_forum_category(auth.uid(), id)
);

-- DELETE policy
DROP POLICY IF EXISTS "Admins and moderators can delete categories" ON public.forum_categories;
CREATE POLICY "Admins and moderators can delete categories"
ON public.forum_categories
FOR DELETE
USING (
  public.can_manage_forum_category(auth.uid(), id)
);
