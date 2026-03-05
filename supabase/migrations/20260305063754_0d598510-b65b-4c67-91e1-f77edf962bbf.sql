
-- Add winner tracking to pbf_games
ALTER TABLE public.pbf_games
ADD COLUMN IF NOT EXISTS winner_user_id uuid;

-- Function to process ELO when a PBF game is completed
CREATE OR REPLACE FUNCTION public.process_pbf_elo_on_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_player RECORD;
  v_winner_elo INTEGER;
  v_avg_opponent_elo INTEGER;
  v_opponent_count INTEGER;
BEGIN
  -- Only fire when status changes to 'completed' and there's a winner
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;
  
  IF NEW.winner_user_id IS NULL OR NEW.game_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Process ELO for each player in the game
  FOR v_player IN
    SELECT user_id FROM public.pbf_game_players
    WHERE pbf_game_id = NEW.id AND status = 'active'
  LOOP
    -- Calculate avg opponent ELO
    SELECT
      COALESCE(AVG(COALESCE(per.elo, 1000)), 1000)::INTEGER,
      COUNT(*)::INTEGER
    INTO v_avg_opponent_elo, v_opponent_count
    FROM public.pbf_game_players gsp
    LEFT JOIN public.player_elo_ratings per ON per.user_id = gsp.user_id AND per.game_id = NEW.game_id
    WHERE gsp.pbf_game_id = NEW.id
      AND gsp.user_id != v_player.user_id
      AND gsp.status = 'active';

    IF v_opponent_count > 0 THEN
      PERFORM public.update_player_elo(
        v_player.user_id,
        NEW.game_id,
        v_avg_opponent_elo,
        v_player.user_id = NEW.winner_user_id
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS process_pbf_elo_trigger ON public.pbf_games;
CREATE TRIGGER process_pbf_elo_trigger
  AFTER UPDATE ON public.pbf_games
  FOR EACH ROW
  EXECUTE FUNCTION public.process_pbf_elo_on_complete();
