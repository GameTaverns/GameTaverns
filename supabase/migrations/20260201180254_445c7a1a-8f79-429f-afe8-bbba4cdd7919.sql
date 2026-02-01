-- Allow library members (not just owners) to log play sessions
-- game_sessions
CREATE POLICY "Members can insert sessions for library games"
ON public.game_sessions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.games g
    WHERE g.id = game_sessions.game_id
      AND public.is_library_member(auth.uid(), g.library_id)
  )
);

-- game_session_players
CREATE POLICY "Members can insert session players for library sessions"
ON public.game_session_players
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.game_sessions gs
    JOIN public.games g ON g.id = gs.game_id
    WHERE gs.id = game_session_players.session_id
      AND public.is_library_member(auth.uid(), g.library_id)
  )
);

-- game_session_expansions
CREATE POLICY "Members can insert session expansions for library sessions"
ON public.game_session_expansions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.game_sessions gs
    JOIN public.games g ON g.id = gs.game_id
    WHERE gs.id = game_session_expansions.session_id
      AND public.is_library_member(auth.uid(), g.library_id)
  )
);
