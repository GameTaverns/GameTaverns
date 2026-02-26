-- Migration 84: Add ownership_status to games table
-- Supports: owned, previously_owned, played_only
-- Used by BGG sync to track games users have played but don't own

SET LOCAL lock_timeout = '5s';

-- Create enum
DO $$ BEGIN
    CREATE TYPE ownership_status AS ENUM ('owned', 'previously_owned', 'played_only');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add column with default 'owned' so existing games are unaffected
ALTER TABLE public.games
ADD COLUMN IF NOT EXISTS ownership_status ownership_status NOT NULL DEFAULT 'owned';

-- Index for efficient filtering by ownership status within a library
CREATE INDEX IF NOT EXISTS idx_games_ownership_status ON public.games(library_id, ownership_status);

NOTIFY pgrst, 'reload schema';
