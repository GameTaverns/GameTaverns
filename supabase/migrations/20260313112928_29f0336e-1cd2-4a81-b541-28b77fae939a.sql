
-- Add expansion_type to game_catalog (catalog-level classification)
ALTER TABLE public.game_catalog 
  ADD COLUMN IF NOT EXISTS expansion_type text NOT NULL DEFAULT 'expansion';

-- Add expansion_type_override to games (library-level override, nullable)
ALTER TABLE public.games 
  ADD COLUMN IF NOT EXISTS expansion_type_override text;

-- Add scoring_type to game_catalog (how this game is scored)
ALTER TABLE public.game_catalog 
  ADD COLUMN IF NOT EXISTS scoring_type text NOT NULL DEFAULT 'highest_wins';

-- Add scoring_type_override to games (library-level override)
ALTER TABLE public.games 
  ADD COLUMN IF NOT EXISTS scoring_type_override text;

-- Add placement to game_session_players (for racing/placement games: 1st, 2nd, 3rd...)
ALTER TABLE public.game_session_players 
  ADD COLUMN IF NOT EXISTS placement integer;

-- Add player_outcome to game_session_players (bankrupt, eliminated, dnf)
ALTER TABLE public.game_session_players 
  ADD COLUMN IF NOT EXISTS player_outcome text;

-- Add cooperative_result to game_sessions (win/lose for co-op games)
ALTER TABLE public.game_sessions 
  ADD COLUMN IF NOT EXISTS cooperative_result text;

-- Add comments explaining valid values
COMMENT ON COLUMN public.game_catalog.expansion_type IS 'expansion, promo, accessory, scenario, mini_expansion';
COMMENT ON COLUMN public.game_catalog.scoring_type IS 'highest_wins, lowest_wins, win_lose, cooperative, no_score';
COMMENT ON COLUMN public.game_session_players.player_outcome IS 'active, bankrupt, eliminated, dnf';
COMMENT ON COLUMN public.game_sessions.cooperative_result IS 'win, lose';
