
-- Fix overly permissive ELO policy -- only system (service role) can write, users/public can read
DROP POLICY IF EXISTS "System can manage ELO ratings" ON public.player_elo_ratings;

-- Only the service role / security definer functions can write ELO
-- Regular authenticated users cannot directly manipulate their ELO
CREATE POLICY "Service role can manage ELO ratings"
  ON public.player_elo_ratings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
