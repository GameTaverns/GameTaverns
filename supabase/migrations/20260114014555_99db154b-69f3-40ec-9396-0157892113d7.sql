-- Add is_coming_soon column to games table
ALTER TABLE public.games ADD COLUMN is_coming_soon BOOLEAN NOT NULL DEFAULT false;

-- Create an index for efficient filtering
CREATE INDEX idx_games_is_coming_soon ON public.games(is_coming_soon);