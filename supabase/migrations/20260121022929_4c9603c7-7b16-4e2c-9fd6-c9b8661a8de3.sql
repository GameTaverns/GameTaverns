-- Restore public SELECT access to game_wishlist table
-- This allows users to see vote counts while writes remain secured through edge function
CREATE POLICY "Public can view wishlist" 
ON public.game_wishlist 
FOR SELECT 
USING (true);