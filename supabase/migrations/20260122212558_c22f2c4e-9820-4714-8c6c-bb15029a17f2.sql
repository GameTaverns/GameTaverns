-- Drop and recreate INSERT policies to explicitly include anon role
DROP POLICY IF EXISTS "Anyone can insert sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Anyone can insert session players" ON public.game_session_players;

-- Recreate with explicit role grants for both anon and authenticated
CREATE POLICY "Anyone can insert sessions"
ON public.game_sessions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can insert session players"
ON public.game_session_players
FOR INSERT
TO anon, authenticated
WITH CHECK (true);