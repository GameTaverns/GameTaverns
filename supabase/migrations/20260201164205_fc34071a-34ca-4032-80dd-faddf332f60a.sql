-- Create table to track which expansions were used in a play session
CREATE TABLE public.game_session_expansions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  expansion_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, expansion_id)
);

-- Enable RLS
ALTER TABLE public.game_session_expansions ENABLE ROW LEVEL SECURITY;

-- Anyone can view session expansions (same as sessions)
CREATE POLICY "Session expansions viewable by everyone"
ON public.game_session_expansions
FOR SELECT
USING (true);

-- Library owners can insert session expansions
CREATE POLICY "Library owners can insert session expansions"
ON public.game_session_expansions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM game_sessions gs
    JOIN games g ON g.id = gs.game_id
    JOIN libraries l ON l.id = g.library_id
    WHERE gs.id = game_session_expansions.session_id
    AND l.owner_id = auth.uid()
  ) OR has_role(auth.uid(), 'admin'::app_role)
);

-- Library owners can delete session expansions
CREATE POLICY "Library owners can delete session expansions"
ON public.game_session_expansions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM game_sessions gs
    JOIN games g ON g.id = gs.game_id
    JOIN libraries l ON l.id = g.library_id
    WHERE gs.id = game_session_expansions.session_id
    AND l.owner_id = auth.uid()
  ) OR has_role(auth.uid(), 'admin'::app_role)
);