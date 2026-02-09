-- Add color column to game_session_players for BGG import
ALTER TABLE public.game_session_players 
  ADD COLUMN IF NOT EXISTS color TEXT;

COMMENT ON COLUMN public.game_session_players.color IS 'Player color/team from the game session (e.g., "Blue", "Red", "Green")';