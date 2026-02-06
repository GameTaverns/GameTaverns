-- =============================================================================
-- GameTaverns Self-Hosted: Library Settings INSERT Policy + Grants
-- Fixes: upsert failing due to missing INSERT policy and table grants
-- Version: 2.7.6
-- =============================================================================

-- Grant INSERT privilege to authenticated role (required for RLS to work)
GRANT INSERT ON public.library_settings TO authenticated;

-- Allow library owners to INSERT their settings row (needed for upsert)
DROP POLICY IF EXISTS "Library owners can insert their settings" ON public.library_settings;
CREATE POLICY "Library owners can insert their settings" ON public.library_settings
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
    );

-- =============================================================================
-- Done
-- =============================================================================
