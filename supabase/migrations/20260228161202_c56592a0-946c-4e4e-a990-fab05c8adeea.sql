-- Update the session_logged trigger to skip imported plays (only emit for manual plays)
CREATE OR REPLACE FUNCTION public.emit_activity_session_logged()
RETURNS TRIGGER AS $$
DECLARE
  owner_id UUID;
  game_title TEXT;
  game_slug TEXT;
BEGIN
  -- Skip imported plays (BGG imports, BG Stats imports, etc.)
  IF NEW.import_source IS NOT NULL AND NEW.import_source != 'manual' THEN
    RETURN NEW;
  END IF;

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