-- Fix security issue: Restrict game_ratings SELECT to admins only
-- The game_ratings_summary view already provides public aggregated data safely

-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Ratings are viewable by everyone" ON public.game_ratings;

-- Create admin-only SELECT policy
CREATE POLICY "Admins can view all ratings"
ON public.game_ratings
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Also allow users to check their own rating by guest_identifier through the edge function
-- The rate-game edge function uses service_role so it bypasses RLS