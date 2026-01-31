-- Add genre field to games table for thematic categorization
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS genre TEXT;

-- Create index for genre filtering
CREATE INDEX IF NOT EXISTS idx_games_genre ON public.games(genre);