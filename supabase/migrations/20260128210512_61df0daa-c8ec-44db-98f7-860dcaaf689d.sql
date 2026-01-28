-- 1. Fix email_confirmation_tokens - deny all direct access
-- The current RESTRICTIVE policy doesn't properly protect the table
DROP POLICY IF EXISTS "Service role can manage email confirmation tokens" ON public.email_confirmation_tokens;

-- Create explicit denial policy (service role bypasses RLS anyway)
CREATE POLICY "Deny all direct access to tokens"
ON public.email_confirmation_tokens
FOR ALL
USING (false)
WITH CHECK (false);

-- 2. Fix game_ratings - replace RESTRICTIVE policies with PERMISSIVE ones
-- and add library owner access
DROP POLICY IF EXISTS "Admins can delete ratings" ON public.game_ratings;
DROP POLICY IF EXISTS "Admins can view all ratings" ON public.game_ratings;
DROP POLICY IF EXISTS "Service role can insert ratings" ON public.game_ratings;
DROP POLICY IF EXISTS "Service role can update ratings" ON public.game_ratings;

-- Admins can fully manage ratings
CREATE POLICY "Admins can view all ratings"
ON public.game_ratings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete ratings"
ON public.game_ratings
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Library owners can view ratings for their games (to see stats)
CREATE POLICY "Library owners can view their game ratings"
ON public.game_ratings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM games g
    JOIN libraries l ON l.id = g.library_id
    WHERE g.id = game_ratings.game_id
    AND l.owner_id = auth.uid()
  )
);

-- 3. Recreate views with security_invoker where appropriate
-- games_public and libraries_public should use security_invoker
-- summary views intentionally use security_definer (default) to bypass RLS on raw tables

DROP VIEW IF EXISTS public.games_public;
CREATE VIEW public.games_public
WITH (security_invoker = on)
AS
SELECT 
  id, title, description, image_url, additional_images,
  min_players, max_players, play_time, difficulty, game_type,
  suggested_age, bgg_id, bgg_url, slug,
  is_expansion, parent_game_id, is_coming_soon, is_for_sale,
  sale_price, sale_condition, library_id,
  sleeved, crowdfunded, in_base_game_box, inserts, upgraded_components,
  location_room, location_shelf, location_misc,
  youtube_videos, publisher_id, created_at, updated_at
FROM public.games;

DROP VIEW IF EXISTS public.libraries_public;
CREATE VIEW public.libraries_public
WITH (security_invoker = on)
AS
SELECT 
  id, name, slug, description, custom_domain,
  is_active, is_premium, created_at, updated_at
FROM public.libraries;

-- Grant access to the views
GRANT SELECT ON public.games_public TO anon, authenticated;
GRANT SELECT ON public.libraries_public TO anon, authenticated;
GRANT SELECT ON public.game_ratings_summary TO anon, authenticated;
GRANT SELECT ON public.game_wishlist_summary TO anon, authenticated;