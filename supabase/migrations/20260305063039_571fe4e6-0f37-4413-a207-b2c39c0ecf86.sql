
-- =====================================================
-- Play-by-Forum (PBF) System
-- =====================================================

-- 1. Add thread_type to forum_threads
ALTER TABLE public.forum_threads
ADD COLUMN IF NOT EXISTS thread_type text NOT NULL DEFAULT 'discussion';

-- 2. Create pbf_games table
CREATE TABLE IF NOT EXISTS public.pbf_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  game_id uuid REFERENCES public.games(id) ON DELETE SET NULL,
  game_title text NOT NULL,
  game_image_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),
  current_player_index integer NOT NULL DEFAULT 0,
  turn_time_limit_hours integer,
  turn_started_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(thread_id)
);

-- 3. Create pbf_game_players table
CREATE TABLE IF NOT EXISTS public.pbf_game_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pbf_game_id uuid NOT NULL REFERENCES public.pbf_games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  player_order integer NOT NULL DEFAULT 0,
  display_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'eliminated', 'withdrew')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pbf_game_id, user_id),
  UNIQUE(pbf_game_id, player_order)
);

-- 4. Create pbf_moves table
CREATE TABLE IF NOT EXISTS public.pbf_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pbf_game_id uuid NOT NULL REFERENCES public.pbf_games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  move_number integer NOT NULL,
  move_text text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pbf_game_id, move_number)
);

-- 5. Enable RLS
ALTER TABLE public.pbf_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pbf_game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pbf_moves ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for pbf_games
-- Anyone authenticated can read PBF games (thread access is controlled by forum)
CREATE POLICY "Authenticated users can view pbf games"
  ON public.pbf_games FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Creator can insert pbf games"
  ON public.pbf_games FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can update pbf games"
  ON public.pbf_games FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

-- 7. RLS Policies for pbf_game_players
CREATE POLICY "Authenticated users can view pbf players"
  ON public.pbf_game_players FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Game creator or self can insert pbf players"
  ON public.pbf_game_players FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.pbf_games g WHERE g.id = pbf_game_id AND g.created_by = auth.uid())
  );

CREATE POLICY "Self can update own player status"
  ON public.pbf_game_players FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- 8. RLS Policies for pbf_moves
CREATE POLICY "Authenticated users can view pbf moves"
  ON public.pbf_moves FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Players can insert own moves"
  ON public.pbf_moves FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = player_id);

-- 9. Auto-advance turn trigger
CREATE OR REPLACE FUNCTION public.pbf_advance_turn()
RETURNS TRIGGER AS $$
DECLARE
  v_game RECORD;
  v_player_count INTEGER;
  v_next_index INTEGER;
BEGIN
  -- Get the PBF game
  SELECT * INTO v_game FROM public.pbf_games WHERE id = NEW.pbf_game_id;
  
  IF v_game.status != 'active' THEN
    RETURN NEW;
  END IF;
  
  -- Count active players
  SELECT COUNT(*) INTO v_player_count
  FROM public.pbf_game_players
  WHERE pbf_game_id = NEW.pbf_game_id AND status = 'active';
  
  -- Calculate next player index (wrap around)
  v_next_index := (v_game.current_player_index + 1) % v_player_count;
  
  -- Advance turn
  UPDATE public.pbf_games
  SET current_player_index = v_next_index,
      turn_started_at = now(),
      updated_at = now()
  WHERE id = NEW.pbf_game_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS pbf_advance_turn_trigger ON public.pbf_moves;
CREATE TRIGGER pbf_advance_turn_trigger
  AFTER INSERT ON public.pbf_moves
  FOR EACH ROW
  EXECUTE FUNCTION public.pbf_advance_turn();

-- 10. Notify next player on turn change
CREATE OR REPLACE FUNCTION public.notify_pbf_turn()
RETURNS TRIGGER AS $$
DECLARE
  v_next_player RECORD;
  v_game_title TEXT;
  v_thread_id UUID;
BEGIN
  -- Only fire when current_player_index changes
  IF OLD.current_player_index IS NOT DISTINCT FROM NEW.current_player_index THEN
    RETURN NEW;
  END IF;
  
  -- Get game info
  v_game_title := NEW.game_title;
  v_thread_id := NEW.thread_id;
  
  -- Get next player
  SELECT p.user_id, COALESCE(p.display_name, 'Player') as name
  INTO v_next_player
  FROM public.pbf_game_players p
  WHERE p.pbf_game_id = NEW.id
    AND p.player_order = NEW.current_player_index
    AND p.status = 'active';
  
  IF v_next_player IS NOT NULL THEN
    PERFORM public.create_notification(
      v_next_player.user_id,
      'pbf_your_turn',
      'It''s your turn in ' || v_game_title || '!',
      'Head to the forum thread to make your move.',
      jsonb_build_object('thread_id', v_thread_id, 'pbf_game_id', NEW.id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS notify_pbf_turn_trigger ON public.pbf_games;
CREATE TRIGGER notify_pbf_turn_trigger
  AFTER UPDATE ON public.pbf_games
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pbf_turn();

-- 11. Updated_at trigger for pbf_games
DROP TRIGGER IF EXISTS update_pbf_games_updated_at ON public.pbf_games;
CREATE TRIGGER update_pbf_games_updated_at
  BEFORE UPDATE ON public.pbf_games
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 12. Update seed triggers to include "Play by Forum" subcategory
CREATE OR REPLACE FUNCTION public.seed_library_forum_categories()
RETURNS TRIGGER AS $$
DECLARE
  general_id uuid;
  marketplace_id uuid;
BEGIN
  INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id)
  VALUES ('General', 'general-parent', 'General community discussions', 'MessageSquare', 'blue', 1, true, NEW.id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO general_id;

  IF general_id IS NULL THEN
    SELECT id INTO general_id FROM public.forum_categories
    WHERE library_id = NEW.id AND slug = 'general-parent' AND parent_category_id IS NULL;
  END IF;

  INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, parent_category_id) VALUES
    ('Announcements', 'announcements', 'Official news and updates', 'Megaphone', 'amber', 1, true, NEW.id, general_id),
    ('General Discussion', 'general', 'Chat about anything board game related', 'MessageSquare', 'blue', 2, true, NEW.id, general_id),
    ('Looking for Group', 'lfg', 'Find other players for game sessions', 'Users', 'green', 3, true, NEW.id, general_id),
    ('Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 4, true, NEW.id, general_id),
    ('Events', 'events', 'Event announcements and discussions', 'Calendar', 'rose', 5, true, NEW.id, general_id),
    ('Play by Forum', 'play-by-forum', 'Asynchronous play-by-forum games', 'Gamepad2', 'indigo', 6, true, NEW.id, general_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id)
  VALUES ('Marketplace', 'marketplace', 'Buy, sell, and trade board games', 'ShoppingBag', 'purple', 2, true, NEW.id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO marketplace_id;

  IF marketplace_id IS NULL THEN
    SELECT id INTO marketplace_id FROM public.forum_categories
    WHERE library_id = NEW.id AND slug = 'marketplace' AND parent_category_id IS NULL;
  END IF;

  INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, parent_category_id) VALUES
    ('Buying', 'buying', 'Looking to buy board games', 'ShoppingCart', 'purple', 1, true, NEW.id, marketplace_id),
    ('Selling', 'selling', 'Board games for sale', 'Tag', 'purple', 2, true, NEW.id, marketplace_id),
    ('Trading', 'trading', 'Trade board games with others', 'ArrowLeftRight', 'purple', 3, true, NEW.id, marketplace_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 13. Update club seed trigger too
CREATE OR REPLACE FUNCTION public.seed_club_forum_categories()
RETURNS TRIGGER AS $$
DECLARE
  general_id uuid;
  marketplace_id uuid;
BEGIN
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status <> 'approved') THEN
    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id)
    VALUES ('General', 'general-parent', 'General community discussions', 'MessageSquare', 'blue', 1, true, NEW.id)
    ON CONFLICT DO NOTHING
    RETURNING id INTO general_id;

    IF general_id IS NULL THEN
      SELECT id INTO general_id FROM public.forum_categories
      WHERE club_id = NEW.id AND slug = 'general-parent' AND parent_category_id IS NULL;
    END IF;

    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id, parent_category_id) VALUES
      ('Announcements', 'announcements', 'Official news and updates', 'Megaphone', 'amber', 1, true, NEW.id, general_id),
      ('General Discussion', 'general', 'Chat about anything board game related', 'MessageSquare', 'blue', 2, true, NEW.id, general_id),
      ('Looking for Group', 'lfg', 'Find other players for game sessions', 'Users', 'green', 3, true, NEW.id, general_id),
      ('Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 4, true, NEW.id, general_id),
      ('Events', 'events', 'Event announcements and discussions', 'Calendar', 'rose', 5, true, NEW.id, general_id),
      ('Play by Forum', 'play-by-forum', 'Asynchronous play-by-forum games', 'Gamepad2', 'indigo', 6, true, NEW.id, general_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id)
    VALUES ('Marketplace', 'marketplace', 'Buy, sell, and trade board games', 'ShoppingBag', 'purple', 2, true, NEW.id)
    ON CONFLICT DO NOTHING
    RETURNING id INTO marketplace_id;

    IF marketplace_id IS NULL THEN
      SELECT id INTO marketplace_id FROM public.forum_categories
      WHERE club_id = NEW.id AND slug = 'marketplace' AND parent_category_id IS NULL;
    END IF;

    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id, parent_category_id) VALUES
      ('Buying', 'buying', 'Looking to buy board games', 'ShoppingCart', 'purple', 1, true, NEW.id, marketplace_id),
      ('Selling', 'selling', 'Board games for sale', 'Tag', 'purple', 2, true, NEW.id, marketplace_id),
      ('Trading', 'trading', 'Trade board games with others', 'ArrowLeftRight', 'purple', 3, true, NEW.id, marketplace_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 14. Backfill "Play by Forum" subcategory for ALL existing library forums
INSERT INTO forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, parent_category_id)
SELECT 'Play by Forum', 'play-by-forum', 'Asynchronous play-by-forum games', 'Gamepad2', 'indigo', 6, true, gp.library_id, gp.id
FROM forum_categories gp
WHERE gp.slug = 'general-parent' AND gp.library_id IS NOT NULL AND gp.parent_category_id IS NULL
AND NOT EXISTS (SELECT 1 FROM forum_categories sub WHERE sub.slug = 'play-by-forum' AND sub.parent_category_id = gp.id);

-- 15. Backfill "Play by Forum" subcategory for ALL existing club forums
INSERT INTO forum_categories (name, slug, description, icon, color, display_order, is_system, club_id, parent_category_id)
SELECT 'Play by Forum', 'play-by-forum', 'Asynchronous play-by-forum games', 'Gamepad2', 'indigo', 6, true, gp.club_id, gp.id
FROM forum_categories gp
WHERE gp.slug = 'general-parent' AND gp.club_id IS NOT NULL AND gp.parent_category_id IS NULL
AND NOT EXISTS (SELECT 1 FROM forum_categories sub WHERE sub.slug = 'play-by-forum' AND sub.parent_category_id = gp.id);

-- 16. Enable realtime for pbf_moves so players see moves in real-time
ALTER PUBLICATION supabase_realtime ADD TABLE public.pbf_moves;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pbf_games;
