
-- =====================================================
-- ELO / Play Log: Linked Players & Global ELO Ratings
-- Version: 3.0.0
-- =====================================================

SET LOCAL lock_timeout = '5s';

-- 1. Extend game_session_players with linked user + tag status
ALTER TABLE public.game_session_players
  ADD COLUMN IF NOT EXISTS linked_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tag_status TEXT NOT NULL DEFAULT 'none'
    CHECK (tag_status IN ('none', 'pending', 'accepted', 'rejected'));

COMMENT ON COLUMN public.game_session_players.linked_user_id IS 'Optional link to a site user profile';
COMMENT ON COLUMN public.game_session_players.tag_status IS 'none=unlinked, pending=awaiting acceptance, accepted=visible on profile, rejected=denied';

-- Index for looking up tagged sessions by user
CREATE INDEX IF NOT EXISTS idx_gsp_linked_user 
  ON public.game_session_players(linked_user_id) 
  WHERE linked_user_id IS NOT NULL;

-- 2. ELO ratings table (per-user, per-game + overall)
CREATE TABLE IF NOT EXISTS public.player_elo_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE, -- NULL = overall ELO
  elo INTEGER NOT NULL DEFAULT 1000,
  games_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  peak_elo INTEGER NOT NULL DEFAULT 1000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, game_id)
);

COMMENT ON TABLE public.player_elo_ratings IS 'ELO ratings per user, scoped per game. NULL game_id = overall ELO.';
COMMENT ON COLUMN public.player_elo_ratings.game_id IS 'NULL means this is the user''s overall cross-game ELO';

CREATE INDEX IF NOT EXISTS idx_elo_game_rank ON public.player_elo_ratings(game_id, elo DESC) WHERE game_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_elo_overall_rank ON public.player_elo_ratings(elo DESC) WHERE game_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_elo_user ON public.player_elo_ratings(user_id);

-- Enable RLS
ALTER TABLE public.player_elo_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ELO ratings are publicly readable" ON public.player_elo_ratings;
CREATE POLICY "ELO ratings are publicly readable"
  ON public.player_elo_ratings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "System can manage ELO ratings" ON public.player_elo_ratings;
CREATE POLICY "System can manage ELO ratings"
  ON public.player_elo_ratings FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Session tag notifications/invites table
CREATE TABLE IF NOT EXISTS public.session_tag_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_player_id UUID NOT NULL REFERENCES public.game_session_players(id) ON DELETE CASCADE,
  tagged_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tagged_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
  game_title TEXT,
  session_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  UNIQUE(session_player_id, tagged_user_id)
);

COMMENT ON TABLE public.session_tag_requests IS 'Pending/resolved session tag requests sent to site users';

CREATE INDEX IF NOT EXISTS idx_str_tagged_user ON public.session_tag_requests(tagged_user_id, status);

ALTER TABLE public.session_tag_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see their own tag requests" ON public.session_tag_requests;
CREATE POLICY "Users can see their own tag requests"
  ON public.session_tag_requests FOR SELECT
  USING (tagged_user_id = auth.uid() OR tagged_by_user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can create tag requests" ON public.session_tag_requests;
CREATE POLICY "Authenticated users can create tag requests"
  ON public.session_tag_requests FOR INSERT
  WITH CHECK (tagged_by_user_id = auth.uid());

DROP POLICY IF EXISTS "Tagged users can update their request status" ON public.session_tag_requests;
CREATE POLICY "Tagged users can update their request status"
  ON public.session_tag_requests FOR UPDATE
  USING (tagged_user_id = auth.uid());

-- 4. ELO calculation function
-- K-factor: 32 for new players (<10 games), 24 for intermediate, 16 for established (30+ games)
CREATE OR REPLACE FUNCTION public.calculate_elo_k_factor(games_played INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN games_played < 10 THEN 32
    WHEN games_played < 30 THEN 24
    ELSE 16
  END;
$$;

-- 5. Update ELO for a user after a game result
CREATE OR REPLACE FUNCTION public.update_player_elo(
  p_user_id UUID,
  p_game_id UUID,
  p_opponent_elo INTEGER,
  p_won BOOLEAN
)
RETURNS INTEGER -- returns new ELO
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_elo INTEGER;
  v_games_played INTEGER;
  v_k INTEGER;
  v_expected NUMERIC;
  v_new_elo INTEGER;
BEGIN
  -- Get or create per-game rating
  INSERT INTO public.player_elo_ratings (user_id, game_id, elo, games_played, wins, losses)
  VALUES (p_user_id, p_game_id, 1000, 0, 0, 0)
  ON CONFLICT (user_id, game_id) DO NOTHING;

  SELECT elo, games_played INTO v_current_elo, v_games_played
  FROM public.player_elo_ratings
  WHERE user_id = p_user_id AND game_id = p_game_id;

  v_k := public.calculate_elo_k_factor(v_games_played);
  v_expected := 1.0 / (1.0 + power(10.0, (p_opponent_elo - v_current_elo)::NUMERIC / 400.0));
  v_new_elo := GREATEST(100, v_current_elo + round(v_k * (CASE WHEN p_won THEN 1 ELSE 0 END - v_expected))::INTEGER);

  UPDATE public.player_elo_ratings
  SET 
    elo = v_new_elo,
    games_played = games_played + 1,
    wins = wins + (CASE WHEN p_won THEN 1 ELSE 0 END),
    losses = losses + (CASE WHEN p_won THEN 0 ELSE 1 END),
    peak_elo = GREATEST(peak_elo, v_new_elo),
    updated_at = now()
  WHERE user_id = p_user_id AND game_id = p_game_id;

  -- Also update overall ELO (NULL game_id)
  INSERT INTO public.player_elo_ratings (user_id, game_id, elo, games_played, wins, losses)
  VALUES (p_user_id, NULL, 1000, 0, 0, 0)
  ON CONFLICT (user_id, game_id) DO NOTHING;

  SELECT elo, games_played INTO v_current_elo, v_games_played
  FROM public.player_elo_ratings
  WHERE user_id = p_user_id AND game_id IS NULL;

  v_k := public.calculate_elo_k_factor(v_games_played);
  v_expected := 1.0 / (1.0 + power(10.0, (p_opponent_elo - v_current_elo)::NUMERIC / 400.0));
  v_new_elo := GREATEST(100, v_current_elo + round(v_k * (CASE WHEN p_won THEN 1 ELSE 0 END - v_expected))::INTEGER);

  UPDATE public.player_elo_ratings
  SET 
    elo = v_new_elo,
    games_played = games_played + 1,
    wins = wins + (CASE WHEN p_won THEN 1 ELSE 0 END),
    losses = losses + (CASE WHEN p_won THEN 0 ELSE 1 END),
    peak_elo = GREATEST(peak_elo, v_new_elo),
    updated_at = now()
  WHERE user_id = p_user_id AND game_id IS NULL;

  RETURN v_new_elo;
END;
$$;

-- 6. Trigger: recalculate ELO when a tag is accepted
CREATE OR REPLACE FUNCTION public.process_elo_on_tag_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_player RECORD;
  v_accepted_user_id UUID;
  v_accepted_won BOOLEAN;
  v_accepted_elo INTEGER;
  v_opponent RECORD;
  v_avg_opponent_elo INTEGER;
  v_opponent_count INTEGER;
BEGIN
  -- Only fire on status change to 'accepted'
  IF NEW.status != 'accepted' OR OLD.status = 'accepted' THEN
    RETURN NEW;
  END IF;

  -- Mark tag as accepted on the player row
  UPDATE public.game_session_players
  SET tag_status = 'accepted', linked_user_id = NEW.tagged_user_id
  WHERE id = NEW.session_player_id;

  -- Get the session and accepted player info
  SELECT gsp.session_id, gsp.is_winner, gs.game_id
  INTO v_player
  FROM public.game_session_players gsp
  JOIN public.game_sessions gs ON gs.id = gsp.session_id
  WHERE gsp.id = NEW.session_player_id;

  v_accepted_user_id := NEW.tagged_user_id;
  v_accepted_won := v_player.is_winner;

  -- Get ELO of this player (default 1000 if new)
  SELECT COALESCE(
    (SELECT elo FROM public.player_elo_ratings WHERE user_id = v_accepted_user_id AND game_id = v_player.game_id),
    1000
  ) INTO v_accepted_elo;

  -- Calculate avg ELO of opponents (other linked players in same session)
  SELECT 
    COALESCE(AVG(COALESCE(per.elo, 1000)), 1000)::INTEGER,
    COUNT(*)::INTEGER
  INTO v_avg_opponent_elo, v_opponent_count
  FROM public.game_session_players gsp2
  LEFT JOIN public.player_elo_ratings per ON per.user_id = gsp2.linked_user_id AND per.game_id = v_player.game_id
  WHERE gsp2.session_id = v_player.session_id
    AND gsp2.id != NEW.session_player_id
    AND gsp2.linked_user_id IS NOT NULL
    AND gsp2.tag_status = 'accepted';

  -- Only update ELO if there are opponents to compare against
  IF v_opponent_count > 0 THEN
    PERFORM public.update_player_elo(
      v_accepted_user_id,
      v_player.game_id,
      v_avg_opponent_elo,
      v_accepted_won
    );
  END IF;

  NEW.resolved_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_elo_on_tag_accept ON public.session_tag_requests;
CREATE TRIGGER trg_elo_on_tag_accept
  BEFORE UPDATE ON public.session_tag_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.process_elo_on_tag_accept();
