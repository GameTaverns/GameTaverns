-- =============================================================================
-- GameTaverns Self-Hosted: RLS Policy Fixes - February 2026
-- Fixes: library_followers/members INSERT, library_settings public SELECT,
--        games is_favorite UPDATE by owners
-- Version: 2.7.5
-- =============================================================================

-- ===========================================
-- Library Followers - Allow authenticated users to follow/unfollow
-- ===========================================
DROP POLICY IF EXISTS "Authenticated users can follow active libraries" ON public.library_followers;
CREATE POLICY "Authenticated users can follow active libraries" ON public.library_followers
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL
        AND auth.uid() = follower_user_id
        AND EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND is_active = true)
    );

DROP POLICY IF EXISTS "Users can unfollow libraries" ON public.library_followers;
CREATE POLICY "Users can unfollow libraries" ON public.library_followers
    FOR DELETE USING (auth.uid() = follower_user_id);

DROP POLICY IF EXISTS "Anyone can view library followers" ON public.library_followers;
CREATE POLICY "Anyone can view library followers" ON public.library_followers
    FOR SELECT USING (true);

-- ===========================================
-- Library Members - Allow authenticated users to join active libraries
-- ===========================================
DROP POLICY IF EXISTS "Authenticated users can join active libraries" ON public.library_members;
CREATE POLICY "Authenticated users can join active libraries" ON public.library_members
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL
        AND auth.uid() = user_id
        AND EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND is_active = true)
    );

DROP POLICY IF EXISTS "Users can leave libraries" ON public.library_members;
CREATE POLICY "Users can leave libraries" ON public.library_members
    FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view library members" ON public.library_members;
CREATE POLICY "Anyone can view library members" ON public.library_members
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND is_active = true)
    );

-- ===========================================
-- Library Settings - Public SELECT for feature flags visibility
-- ===========================================
DROP POLICY IF EXISTS "Anyone can view library settings for feature flags" ON public.library_settings;
CREATE POLICY "Anyone can view library settings for feature flags" ON public.library_settings
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND is_active = true)
    );

-- Ensure owners can still UPDATE their settings
DROP POLICY IF EXISTS "Library owners can update their settings" ON public.library_settings;
CREATE POLICY "Library owners can update their settings" ON public.library_settings
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
    );

-- ===========================================
-- Games - Ensure is_favorite can be updated by owners
-- (This should already work via existing UPDATE policy, but let's ensure it)
-- ===========================================
-- The existing "Library owners can update their games" policy should cover this
-- No changes needed if it exists, but let's make sure it's there

DROP POLICY IF EXISTS "Library owners can update their games" ON public.games;
CREATE POLICY "Library owners can update their games" ON public.games
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
    );

-- ===========================================
-- Done
-- ===========================================
