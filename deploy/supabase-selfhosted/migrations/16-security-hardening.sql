-- =============================================================================
-- GameTaverns Self-Hosted: Security Hardening
-- Version: 2.3.2 - Schema Parity Audit
-- =============================================================================

-- ===========================================
-- Fix Library Members Policy
-- Prevent public exposure of user_ids
-- ===========================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view library members" ON public.library_members;

-- Create restricted policy - only authenticated members can see member lists
CREATE POLICY "Authenticated users can view library members" ON public.library_members
    FOR SELECT 
    TO authenticated
    USING (
        -- Users can see members of libraries they're part of
        public.is_library_member(auth.uid(), library_id)
        -- Or if they're an admin
        OR public.has_role(auth.uid(), 'admin')
    );

-- ===========================================
-- Game Session Expansions - Member Access
-- Allow library members to insert session expansions
-- ===========================================
DROP POLICY IF EXISTS "Members can insert session expansions for library sessions" ON public.game_session_expansions;
CREATE POLICY "Members can insert session expansions for library sessions" ON public.game_session_expansions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.game_sessions gs
            JOIN public.games g ON g.id = gs.game_id
            WHERE gs.id = session_id AND public.is_library_member(auth.uid(), g.library_id)
        )
    );

-- ===========================================
-- Game Sessions - Member Access
-- Allow library members to insert sessions
-- ===========================================
DROP POLICY IF EXISTS "Members can insert sessions for library games" ON public.game_sessions;
CREATE POLICY "Members can insert sessions for library games" ON public.game_sessions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.games g
            WHERE g.id = game_id AND public.is_library_member(auth.uid(), g.library_id)
        )
    );

-- ===========================================
-- Game Session Players - Member Access
-- Allow library members to insert session players
-- ===========================================
DROP POLICY IF EXISTS "Members can insert session players for library sessions" ON public.game_session_players;
CREATE POLICY "Members can insert session players for library sessions" ON public.game_session_players
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.game_sessions gs
            JOIN public.games g ON g.id = gs.game_id
            WHERE gs.id = session_id AND public.is_library_member(auth.uid(), g.library_id)
        )
    );

-- ===========================================
-- Game Ratings Library View (sanitized)
-- Excludes IP and fingerprint data
-- ===========================================
CREATE OR REPLACE VIEW public.game_ratings_library_view 
WITH (security_invoker = true)
AS
SELECT 
    id,
    game_id,
    guest_identifier,
    rating,
    created_at,
    updated_at
    -- Excluded: ip_address, device_fingerprint (sensitive tracking data)
FROM public.game_ratings;
