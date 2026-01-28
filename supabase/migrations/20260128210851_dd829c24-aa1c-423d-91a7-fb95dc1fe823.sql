-- Add unique constraint for wishlist upsert to work properly
ALTER TABLE public.game_wishlist 
ADD CONSTRAINT game_wishlist_game_guest_unique 
UNIQUE (game_id, guest_identifier);