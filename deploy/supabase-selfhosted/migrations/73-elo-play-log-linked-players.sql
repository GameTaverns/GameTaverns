-- =============================================================================
-- ELO / Linked Play Log System
-- Version: 73
-- Adds linked_user_id + tag_status to game_session_players,
-- session_tag_requests table, and player_elo_ratings table with triggers.
-- =============================================================================

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. Extend game_session_players with player linking
-- ---------------------------------------------------------------------------
ALTER TABLE public.game_session_players
  ADD COLUMN IF NOT EXISTS linked_user_id UUID,
  ADD COLUMN IF NOT EXISTS tag_status TEXT NOT NULL DEFAULT 'none'
    CHECK (tag_status IN ('none', 'pending', 'accepted', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_gsp_linked_user ON public.game_session_players(linked_user_id)
  WHERE linked_user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Session Tag Requests (pending/accepted/rejected flow)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_tag_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_player_id UUID NOT NULL,
  session_id        UUID NOT NULL,
  tagger_user_id    UUID NOT NULL,
  tagged_user_id    UUID NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ,
  UNIQUE(session_player_id, tagged_user_id)
);

CREATE INDEX IF NOT EXISTS idx_tag_req_tagged ON public.session_tag_requests(tagged_user_id, status);
CREATE INDEX IF NOT EXISTS idx_tag_req_session ON public.session_tag_requests(session_id);

ALTER TABLE public.session_tag_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view their own tag requests"
    ON public.session_tag_requests FOR SELECT
    TO authenticated
    USING (auth.uid() = tagged_user_id OR auth.uid() = tagger_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can create tag requests"
    ON public.session_tag_requests FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = tagger_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Tagged users can update their tag requests"
    ON public.session_tag_requests FOR UPDATE
    TO authenticated
    USING (auth.uid() = tagged_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 3. Player ELO Ratings (per-game + overall via NULL game_id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_elo_ratings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL,
  game_id      UUID,
  elo          INTEGER NOT NULL DEFAULT 1000,
  games_played INTEGER NOT NULL DEFAULT 0,
  wins         INTEGER NOT NULL DEFAULT 0,
  losses       INTEGER NOT NULL DEFAULT 0,
  peak_elo     INTEGER NOT NULL DEFAULT 1000,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_elo_user ON public.player_elo_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_elo_game ON public.player_elo_ratings(game_id) WHERE game_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_elo_game_rank ON public.player_elo_ratings(game_id, elo DESC);

ALTER TABLE public.player_elo_ratings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "ELO ratings are publicly readable"
    ON public.player_elo_ratings FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can manage ELO ratings"
    ON public.player_elo_ratings FOR ALL
    TO service_role
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 4. ELO Helper Functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.calculate_elo_k_factor(games_played INTEGER)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE
SET search_path = 'public'
AS $$
  SELECT CASE
    WHEN games_played < 10 THEN 32
    WHEN games_played < 30 THEN 24
    ELSE 16
  END;
$$;

CREATE OR REPLACE FUNCTION public.update_player_elo(
  p_user_id      UUID,
  p_game_id      UUID,
  p_opponent_elo INTEGER,
  p_won          BOOLEAN
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_current_elo  INTEGER;
  v_games_played INTEGER;
  v_k            INTEGER;
  v_expected     NUMERIC;
  v_new_elo      INTEGER;
BEGIN
  -- Get or create per-game rating
  INSERT INTO public.player_elo_ratings (user_id, game_id, elo, games_played, wins, losses)
  VALUES (p_user_id, p_game_id, 1000, 0, 0, 0)
  ON CONFLICT (user_id, game_id) DO NOTHING;

  SELECT elo, games_played INTO v_current_elo, v_games_played
  FROM public.player_elo_ratings
  WHERE user_id = p_user_id AND game_id IS NOT DISTINCT FROM p_game_id;

  v_k        := public.calculate_elo_k_factor(v_games_played);
  v_expected := 1.0 / (1.0 + power(10.0, (p_opponent_elo - v_current_elo)::NUMERIC / 400.0));
  v_new_elo  := GREATEST(100, v_current_elo + round(v_k * (CASE WHEN p_won THEN 1 ELSE 0 END - v_expected))::INTEGER);

  UPDATE public.player_elo_ratings
  SET
    elo          = v_new_elo,
    games_played = games_played + 1,
    wins         = wins   + (CASE WHEN p_won THEN 1 ELSE 0 END),
    losses       = losses + (CASE WHEN p_won THEN 0 ELSE 1 END),
    peak_elo     = GREATEST(peak_elo, v_new_elo),
    updated_at   = now()
  WHERE user_id = p_user_id AND game_id IS NOT DISTINCT FROM p_game_id;

  -- Also update overall ELO (NULL game_id)
  IF p_game_id IS NOT NULL THEN
    INSERT INTO public.player_elo_ratings (user_id, game_id, elo, games_played, wins, losses)
    VALUES (p_user_id, NULL, 1000, 0, 0, 0)
    ON CONFLICT (user_id, game_id) DO NOTHING;

    SELECT elo, games_played INTO v_current_elo, v_games_played
    FROM public.player_elo_ratings
    WHERE user_id = p_user_id AND game_id IS NULL;

    v_k        := public.calculate_elo_k_factor(v_games_played);
    v_expected := 1.0 / (1.0 + power(10.0, (p_opponent_elo - v_current_elo)::NUMERIC / 400.0));
    v_new_elo  := GREATEST(100, v_current_elo + round(v_k * (CASE WHEN p_won THEN 1 ELSE 0 END - v_expected))::INTEGER);

    UPDATE public.player_elo_ratings
    SET
      elo          = v_new_elo,
      games_played = games_played + 1,
      wins         = wins   + (CASE WHEN p_won THEN 1 ELSE 0 END),
      losses       = losses + (CASE WHEN p_won THEN 0 ELSE 1 END),
      peak_elo     = GREATEST(peak_elo, v_new_elo),
      updated_at   = now()
    WHERE user_id = p_user_id AND game_id IS NULL;
  END IF;

  RETURN v_new_elo;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. ELO Update Trigger: fires when a tag is accepted
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.process_elo_on_tag_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_session        RECORD;
  v_player         RECORD;
  v_accepted_user_id UUID;
  v_accepted_won   BOOLEAN;
  v_accepted_elo   INTEGER;
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
  v_accepted_won     := v_player.is_winner;

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
  LEFT JOIN public.player_elo_ratings per
    ON per.user_id = gsp2.linked_user_id AND per.game_id = v_player.game_id
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
