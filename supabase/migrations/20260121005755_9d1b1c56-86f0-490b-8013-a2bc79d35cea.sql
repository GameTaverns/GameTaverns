-- Create game wishlist table for guest voting
CREATE TABLE public.game_wishlist (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    guest_name TEXT, -- Optional guest name
    guest_identifier TEXT NOT NULL, -- Browser fingerprint or session ID for deduplication
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX idx_game_wishlist_game_id ON public.game_wishlist(game_id);
CREATE INDEX idx_game_wishlist_guest_identifier ON public.game_wishlist(guest_identifier);

-- Unique constraint to prevent duplicate votes from same guest on same game
CREATE UNIQUE INDEX idx_game_wishlist_unique_vote ON public.game_wishlist(game_id, guest_identifier);

-- Enable RLS
ALTER TABLE public.game_wishlist ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view wishlist (for showing vote counts)
CREATE POLICY "Wishlist is viewable by everyone"
ON public.game_wishlist
FOR SELECT
USING (true);

-- Allow anyone to add to wishlist
CREATE POLICY "Anyone can add to wishlist"
ON public.game_wishlist
FOR INSERT
WITH CHECK (true);

-- Allow guests to remove their own votes
CREATE POLICY "Guests can remove their own votes"
ON public.game_wishlist
FOR DELETE
USING (true);

-- Admins can manage all wishlist entries
CREATE POLICY "Admins can manage wishlist"
ON public.game_wishlist
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create a view for public vote counts (excludes guest identifiers)
CREATE VIEW public.game_wishlist_summary AS
SELECT 
    game_id,
    COUNT(*) as vote_count,
    COUNT(CASE WHEN guest_name IS NOT NULL AND guest_name != '' THEN 1 END) as named_votes
FROM public.game_wishlist
GROUP BY game_id;