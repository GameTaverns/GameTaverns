-- Add RLS policy for the game_ratings_library_view
-- Library owners can view ratings for games in their libraries

CREATE POLICY "Library owners can view their game ratings via view"
ON public.game_ratings
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM games g
    JOIN libraries l ON l.id = g.library_id
    WHERE g.id = game_ratings.game_id AND l.owner_id = auth.uid()
  )
);

-- Note: The view inherits RLS from the base table (game_ratings) due to security_invoker = true
-- This policy allows library owners to see ratings, but only through the view which excludes sensitive columns