-- Create game_sessions table for tracking plays
CREATE TABLE public.game_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  played_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create game_session_players table for player details
CREATE TABLE public.game_session_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  score INTEGER,
  is_winner BOOLEAN NOT NULL DEFAULT false,
  is_first_play BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_session_players ENABLE ROW LEVEL SECURITY;

-- RLS policies for game_sessions
CREATE POLICY "Sessions viewable by everyone"
  ON public.game_sessions FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert sessions"
  ON public.game_sessions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update sessions"
  ON public.game_sessions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete sessions"
  ON public.game_sessions FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for game_session_players
CREATE POLICY "Session players viewable by everyone"
  ON public.game_session_players FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert session players"
  ON public.game_session_players FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update session players"
  ON public.game_session_players FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete session players"
  ON public.game_session_players FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Update trigger for game_sessions
CREATE TRIGGER update_game_sessions_updated_at
  BEFORE UPDATE ON public.game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_game_sessions_game_id ON public.game_sessions(game_id);
CREATE INDEX idx_game_sessions_played_at ON public.game_sessions(played_at DESC);
CREATE INDEX idx_game_session_players_session_id ON public.game_session_players(session_id);