
-- Allow library owners and co-owners to update member roles
DROP POLICY IF EXISTS "Library owners can update member roles" ON public.library_members;
CREATE POLICY "Library owners can update member roles" ON public.library_members
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
        OR public.is_library_co_owner(auth.uid(), library_id)
        OR public.has_role(auth.uid(), 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
        OR public.is_library_co_owner(auth.uid(), library_id)
        OR public.has_role(auth.uid(), 'admin')
    );
