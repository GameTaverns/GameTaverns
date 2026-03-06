-- Add is_visible column to club_libraries (default false = hidden by default)
ALTER TABLE public.club_libraries
ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT false;

-- Allow club owners and library owners to update visibility
DROP POLICY IF EXISTS "Club owners can update library visibility" ON public.club_libraries;
CREATE POLICY "Club owners can update library visibility"
ON public.club_libraries FOR UPDATE
TO authenticated
USING (
  public.is_club_owner(auth.uid(), club_id)
  OR EXISTS (
    SELECT 1 FROM public.libraries
    WHERE id = club_libraries.library_id AND owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.library_members
    WHERE library_id = club_libraries.library_id AND user_id = auth.uid() AND role::text = 'co_owner'
  )
)
WITH CHECK (
  public.is_club_owner(auth.uid(), club_id)
  OR EXISTS (
    SELECT 1 FROM public.libraries
    WHERE id = club_libraries.library_id AND owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.library_members
    WHERE library_id = club_libraries.library_id AND user_id = auth.uid() AND role::text = 'co_owner'
  )
);