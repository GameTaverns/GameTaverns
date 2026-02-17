-- Activity event triggers for social feed
-- Version: 68

-- Trigger: game added
CREATE OR REPLACE FUNCTION public.emit_activity_game_added()
RETURNS TRIGGER AS $$
DECLARE
  owner_id UUID;
BEGIN
  SELECT l.owner_id INTO owner_id
  FROM public.libraries l WHERE l.id = NEW.library_id;

  IF owner_id IS NOT NULL THEN
    INSERT INTO public.activity_events (user_id, event_type, metadata)
    VALUES (
      owner_id,
      CASE WHEN NEW.is_expansion THEN 'expansion_added' ELSE 'game_added' END,
      jsonb_build_object('title', NEW.title, 'game_id', NEW.id, 'image_url', NEW.image_url, 'slug', NEW.slug)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_activity_game_added ON public.games;
CREATE TRIGGER trg_activity_game_added
  AFTER INSERT ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.emit_activity_game_added();

-- Trigger: session logged
CREATE OR REPLACE FUNCTION public.emit_activity_session_logged()
RETURNS TRIGGER AS $$
DECLARE
  owner_id UUID;
  game_title TEXT;
  game_slug TEXT;
BEGIN
  SELECT l.owner_id, g.title, g.slug INTO owner_id, game_title, game_slug
  FROM public.games g JOIN public.libraries l ON l.id = g.library_id
  WHERE g.id = NEW.game_id;

  IF owner_id IS NOT NULL THEN
    INSERT INTO public.activity_events (user_id, event_type, metadata)
    VALUES (
      owner_id, 'session_logged',
      jsonb_build_object('title', game_title, 'game_id', NEW.game_id, 'slug', game_slug, 'duration_minutes', NEW.duration_minutes)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_activity_session_logged ON public.game_sessions;
CREATE TRIGGER trg_activity_session_logged
  AFTER INSERT ON public.game_sessions
  FOR EACH ROW EXECUTE FUNCTION public.emit_activity_session_logged();

-- Trigger: achievement earned
CREATE OR REPLACE FUNCTION public.emit_activity_achievement_earned()
RETURNS TRIGGER AS $$
DECLARE
  ach_name TEXT;
  ach_icon TEXT;
BEGIN
  SELECT name, icon INTO ach_name, ach_icon
  FROM public.achievements WHERE id = NEW.achievement_id;

  INSERT INTO public.activity_events (user_id, event_type, metadata)
  VALUES (
    NEW.user_id, 'achievement_earned',
    jsonb_build_object('name', COALESCE(ach_name, 'Achievement'), 'icon', COALESCE(ach_icon, '🏆'), 'achievement_id', NEW.achievement_id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_activity_achievement_earned ON public.user_achievements;
CREATE TRIGGER trg_activity_achievement_earned
  AFTER INSERT ON public.user_achievements
  FOR EACH ROW EXECUTE FUNCTION public.emit_activity_achievement_earned();

-- Trigger: forum thread created
CREATE OR REPLACE FUNCTION public.emit_activity_forum_post()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.activity_events (user_id, event_type, metadata)
  VALUES (
    NEW.author_id, 'forum_post',
    jsonb_build_object('title', NEW.title, 'thread_id', NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_activity_forum_post ON public.forum_threads;
CREATE TRIGGER trg_activity_forum_post
  AFTER INSERT ON public.forum_threads
  FOR EACH ROW EXECUTE FUNCTION public.emit_activity_forum_post();

-- Trigger: library created
CREATE OR REPLACE FUNCTION public.emit_activity_library_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.activity_events (user_id, event_type, metadata)
  VALUES (
    NEW.owner_id, 'library_created',
    jsonb_build_object('name', NEW.name, 'slug', NEW.slug)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_activity_library_created ON public.libraries;
CREATE TRIGGER trg_activity_library_created
  AFTER INSERT ON public.libraries
  FOR EACH ROW EXECUTE FUNCTION public.emit_activity_library_created();
