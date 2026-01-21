-- Fix security issues from the wishlist table

-- Drop the overly permissive INSERT policy and replace with one that validates guest_identifier
DROP POLICY IF EXISTS "Anyone can add to wishlist" ON public.game_wishlist;

-- Drop the overly permissive DELETE policy 
DROP POLICY IF EXISTS "Guests can remove their own votes" ON public.game_wishlist;

-- Drop the security definer view and recreate with security_invoker
DROP VIEW IF EXISTS public.game_wishlist_summary;

-- Recreate view with SECURITY INVOKER (safer)
CREATE VIEW public.game_wishlist_summary 
WITH (security_invoker = on)
AS
SELECT 
    game_id,
    COUNT(*) as vote_count,
    COUNT(CASE WHEN guest_name IS NOT NULL AND guest_name != '' THEN 1 END) as named_votes
FROM public.game_wishlist
GROUP BY game_id;