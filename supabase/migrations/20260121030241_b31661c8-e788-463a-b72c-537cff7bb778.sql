-- Fix: Remove public SELECT access to game_wishlist table
-- This prevents exposure of guest_identifier values that enable user tracking

-- Drop the overly permissive public SELECT policies
DROP POLICY IF EXISTS "Wishlist is viewable by everyone" ON public.game_wishlist;
DROP POLICY IF EXISTS "Public can view wishlist" ON public.game_wishlist;

-- The existing "Admins can manage wishlist" policy already covers admin SELECT access
-- Public users can still see vote counts via the game_wishlist_summary view (which doesn't expose guest_identifier)