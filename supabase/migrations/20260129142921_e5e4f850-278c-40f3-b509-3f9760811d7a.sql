-- =====================
-- Fix Security Vulnerabilities
-- =====================

-- 1. FIX: user_profiles_public_exposure
-- Drop existing view first to recreate with correct columns
DROP VIEW IF EXISTS public.user_profiles_public;

-- Create a public view that excludes sensitive data (user_id, discord_user_id)
CREATE VIEW public.user_profiles_public
WITH (security_invoker = on) AS
SELECT 
    id,
    display_name,
    username,
    avatar_url,
    bio,
    created_at
    -- Excludes: user_id, discord_user_id (sensitive identifiers)
FROM public.user_profiles;

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.user_profiles;

-- Add a more restrictive public SELECT policy - only allow viewing via the public view
-- or by the user themselves, or by admins
CREATE POLICY "Public can view limited profile data via view"
ON public.user_profiles
FOR SELECT
USING (
    -- Allow users to view their own profile
    auth.uid() = user_id
    -- Allow admins to view all profiles
    OR has_role(auth.uid(), 'admin'::app_role)
    -- Allow viewing profiles of library owners (needed for library display)
    OR EXISTS (
        SELECT 1 FROM libraries 
        WHERE libraries.owner_id = user_profiles.user_id 
        AND libraries.is_active = true
    )
);

-- 2. FIX: library_settings_webhook_exposure
-- Drop the overly permissive public policy on library_settings
DROP POLICY IF EXISTS "Public can view settings of active libraries via view" ON public.library_settings;

-- The library_settings_public view already exists and excludes sensitive fields
-- Just ensure public access goes through the view, not the base table

-- 3. FIX: game_sessions_unrestricted_write
-- Drop the permissive insert policy
DROP POLICY IF EXISTS "Anyone can insert sessions" ON public.game_sessions;

-- Add a proper policy that restricts session creation to library owners
CREATE POLICY "Library owners can insert sessions for their games"
ON public.game_sessions
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM games g
        JOIN libraries l ON l.id = g.library_id
        WHERE g.id = game_sessions.game_id
        AND l.owner_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
);

-- Also add update policy for library owners
DROP POLICY IF EXISTS "Admins can update sessions" ON public.game_sessions;

CREATE POLICY "Library owners can update sessions for their games"
ON public.game_sessions
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM games g
        JOIN libraries l ON l.id = g.library_id
        WHERE g.id = game_sessions.game_id
        AND l.owner_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
);

-- Also add delete policy for library owners
DROP POLICY IF EXISTS "Admins can delete sessions" ON public.game_sessions;

CREATE POLICY "Library owners can delete sessions for their games"
ON public.game_sessions
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM games g
        JOIN libraries l ON l.id = g.library_id
        WHERE g.id = game_sessions.game_id
        AND l.owner_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
);

-- 4. FIX: game_session_players unrestricted write (related issue)
DROP POLICY IF EXISTS "Anyone can insert session players" ON public.game_session_players;

CREATE POLICY "Library owners can insert session players"
ON public.game_session_players
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM game_sessions gs
        JOIN games g ON g.id = gs.game_id
        JOIN libraries l ON l.id = g.library_id
        WHERE gs.id = game_session_players.session_id
        AND l.owner_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
);

-- Update/delete policies for session players
DROP POLICY IF EXISTS "Admins can update session players" ON public.game_session_players;

CREATE POLICY "Library owners can update session players"
ON public.game_session_players
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM game_sessions gs
        JOIN games g ON g.id = gs.game_id
        JOIN libraries l ON l.id = g.library_id
        WHERE gs.id = game_session_players.session_id
        AND l.owner_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Admins can delete session players" ON public.game_session_players;

CREATE POLICY "Library owners can delete session players"
ON public.game_session_players
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM game_sessions gs
        JOIN games g ON g.id = gs.game_id
        JOIN libraries l ON l.id = g.library_id
        WHERE gs.id = game_session_players.session_id
        AND l.owner_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
);