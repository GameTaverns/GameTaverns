-- Migration: Enhanced review system with Owner/Player dual scoring
-- 1. Add reviewer_type column to distinguish owner vs player reviews
-- This gets dynamically updated based on ownership status
ALTER TABLE public.game_reviews 
  ADD COLUMN IF NOT EXISTS reviewer_type TEXT NOT NULL DEFAULT 'player';

-- Update existing reviews: owned/previously_owned → 'owner', played_only → 'player'
UPDATE public.game_reviews 
  SET reviewer_type = CASE 
    WHEN ownership_status IN ('owned', 'previously_owned') THEN 'owner'
    ELSE 'player'
  END;

CREATE INDEX IF NOT EXISTS idx_game_reviews_reviewer_type ON public.game_reviews(reviewer_type);
CREATE INDEX IF NOT EXISTS idx_game_reviews_catalog_reviewer_type ON public.game_reviews(catalog_id, reviewer_type, status);

-- 2. Add plays tracking for review update prompts
-- Tracks how many plays the user had when last prompted to update their review
ALTER TABLE public.game_reviews 
  ADD COLUMN IF NOT EXISTS plays_at_last_prompt INTEGER DEFAULT 0;

-- 3. Update ownership_status to also support 'played_only' 
-- (previously only 'owned' and 'previously_owned' were used)
-- The column is already TEXT type so no constraint change needed.

NOTIFY pgrst, 'reload schema';