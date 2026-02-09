-- =============================================================================
-- BGG Play Log Import Support
-- Version: 2.3.3
-- =============================================================================

-- Add columns to game_sessions for BGG import tracking
ALTER TABLE public.game_sessions 
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS bgg_play_id TEXT,
  ADD COLUMN IF NOT EXISTS import_source TEXT;

-- Create unique index on bgg_play_id + game_id for deduplication
-- Scoped per game (and thus per library) so each library can import independently
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_sessions_bgg_play_id 
  ON public.game_sessions(bgg_play_id, game_id) 
  WHERE bgg_play_id IS NOT NULL;

-- Add index for efficient querying by import source
CREATE INDEX IF NOT EXISTS idx_game_sessions_import_source 
  ON public.game_sessions(import_source) 
  WHERE import_source IS NOT NULL;

-- Comment the new columns
COMMENT ON COLUMN public.game_sessions.location IS 'Location where the game was played (e.g., "Game Night at Mike''s")';
COMMENT ON COLUMN public.game_sessions.bgg_play_id IS 'BoardGameGeek play ID for deduplication during import';
COMMENT ON COLUMN public.game_sessions.import_source IS 'Source of the play log (e.g., "bgg", "manual")';
