-- Migration 96: Reviewer type for dual scoring (Owner vs Player)
SET LOCAL lock_timeout = '5s';

-- Add reviewer_type column to distinguish owner vs player reviews
ALTER TABLE public.game_reviews 
  ADD COLUMN IF NOT EXISTS reviewer_type TEXT NOT NULL DEFAULT 'player';

-- Backfill: owned/previously_owned → 'owner', played_only → 'player'
UPDATE public.game_reviews 
  SET reviewer_type = CASE 
    WHEN ownership_status IN ('owned', 'previously_owned') THEN 'owner'
    ELSE 'player'
  END;

CREATE INDEX IF NOT EXISTS idx_game_reviews_reviewer_type ON public.game_reviews(reviewer_type);
CREATE INDEX IF NOT EXISTS idx_game_reviews_catalog_reviewer_type ON public.game_reviews(catalog_id, reviewer_type, status);

-- Add plays tracking for review update prompts
ALTER TABLE public.game_reviews 
  ADD COLUMN IF NOT EXISTS plays_at_last_prompt INTEGER DEFAULT 0;

NOTIFY pgrst, 'reload schema';
