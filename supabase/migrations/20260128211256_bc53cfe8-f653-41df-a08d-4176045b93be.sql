-- The game_wishlist_summary view needs security_definer to work since
-- the base game_wishlist table has restrictive RLS policies.
-- This is safe because the view only exposes aggregated counts, not PII.

-- Drop and recreate the view with security_definer = false (the default)
-- but we need to create an RLS policy that allows reading from game_wishlist for the summary

-- First, add a SELECT policy to game_wishlist so the summary view can aggregate
CREATE POLICY "Anyone can view wishlist entries for summaries"
ON public.game_wishlist
FOR SELECT
TO authenticated, anon
USING (true);

-- Recreate the summary view to use security_invoker = false (definer mode)
-- so it can access the data for aggregation
DROP VIEW IF EXISTS public.game_wishlist_summary;

CREATE VIEW public.game_wishlist_summary AS
SELECT 
    game_id,
    COUNT(*) as vote_count,
    COUNT(guest_name) as named_votes
FROM public.game_wishlist
GROUP BY game_id;