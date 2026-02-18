-- Add column to track BGG-verified type for each catalog entry
-- NULL = unchecked, 'boardgame'/'boardgameexpansion' = verified valid, 'invalid' = not a boardgame
ALTER TABLE public.game_catalog
  ADD COLUMN IF NOT EXISTS bgg_verified_type TEXT DEFAULT NULL;

-- Index to speed up cleanup queries (prioritise unchecked entries)
CREATE INDEX IF NOT EXISTS idx_game_catalog_bgg_verified_type
  ON public.game_catalog (bgg_verified_type)
  WHERE bgg_id IS NOT NULL;