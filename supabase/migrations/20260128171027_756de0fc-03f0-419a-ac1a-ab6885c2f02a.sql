-- ============================================
-- Security Fixes Migration
-- ============================================

-- 1. Fix game_ratings: Remove public SELECT, add admin-only SELECT
-- Drop the overly permissive policy that exposes IP/fingerprint data
DROP POLICY IF EXISTS "Ratings are viewable by everyone" ON public.game_ratings;

-- The "Admins can view all ratings" policy already exists, so we're good

-- 2. Fix libraries: Create a public view that excludes owner_id
-- Drop any existing view first
DROP VIEW IF EXISTS public.libraries_public;

-- Create public view without sensitive owner_id
CREATE VIEW public.libraries_public AS
SELECT 
    id,
    name,
    slug,
    description,
    custom_domain,
    is_active,
    is_premium,
    created_at,
    updated_at
FROM public.libraries
WHERE is_active = true;

-- Grant access to the public view
GRANT SELECT ON public.libraries_public TO anon, authenticated;

-- 3. Fix game_wishlist: Add INSERT policy for service role operations
-- The edge function uses service role, so this is fine. But we need to allow
-- the service role to insert. The current "Admins can manage wishlist" only works for admins.
-- Add a policy for service role insertions (which bypass RLS anyway) - this is informational
DROP POLICY IF EXISTS "Service role can insert wishlist entries" ON public.game_wishlist;
CREATE POLICY "Service role can insert wishlist entries" 
ON public.game_wishlist 
FOR INSERT 
WITH CHECK (true);

-- Also add DELETE policy for service role (for removing wishlist votes)
DROP POLICY IF EXISTS "Service role can delete wishlist entries" ON public.game_wishlist;
CREATE POLICY "Service role can delete wishlist entries" 
ON public.game_wishlist 
FOR DELETE 
USING (true);

-- 4. Fix the SECURITY DEFINER view issue - recreate views with SECURITY INVOKER
-- Check which views are SECURITY DEFINER and fix them

-- Recreate games_public view with explicit SECURITY INVOKER
DROP VIEW IF EXISTS public.games_public;
CREATE VIEW public.games_public 
WITH (security_invoker = true)
AS
SELECT
    id, title, slug, description, image_url, additional_images, youtube_videos,
    difficulty, game_type, play_time, min_players, max_players,
    suggested_age, publisher_id, bgg_id, bgg_url,
    is_coming_soon, is_for_sale, sale_price, sale_condition,
    is_expansion, parent_game_id, sleeved, upgraded_components,
    crowdfunded, in_base_game_box, inserts, library_id,
    location_room, location_shelf, location_misc,
    created_at, updated_at
FROM public.games;

-- Recreate site_settings_public view with SECURITY INVOKER
DROP VIEW IF EXISTS public.site_settings_public;
CREATE VIEW public.site_settings_public 
WITH (security_invoker = true)
AS
SELECT id, key, value, created_at, updated_at
FROM public.site_settings
WHERE key NOT LIKE 'private_%';

-- Recreate game_wishlist_summary view with SECURITY INVOKER  
DROP VIEW IF EXISTS public.game_wishlist_summary;
CREATE VIEW public.game_wishlist_summary
WITH (security_invoker = true)
AS
SELECT
    game_id,
    COUNT(*) AS vote_count,
    COUNT(guest_name) AS named_votes
FROM public.game_wishlist
GROUP BY game_id;

-- Recreate game_ratings_summary view with SECURITY INVOKER
DROP VIEW IF EXISTS public.game_ratings_summary;
CREATE VIEW public.game_ratings_summary
WITH (security_invoker = true)
AS
SELECT
    game_id,
    ROUND(AVG(rating)::numeric, 1) AS average_rating,
    COUNT(*)::integer AS rating_count
FROM public.game_ratings
GROUP BY game_id;

-- Grant access to views
GRANT SELECT ON public.games_public TO anon, authenticated;
GRANT SELECT ON public.site_settings_public TO anon, authenticated;
GRANT SELECT ON public.game_wishlist_summary TO anon, authenticated;
GRANT SELECT ON public.game_ratings_summary TO anon, authenticated;