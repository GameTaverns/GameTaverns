
-- Update the emit_activity_photo_posted trigger to also create photo_tagged events for @mentioned users
CREATE OR REPLACE FUNCTION public.emit_activity_photo_posted()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  _mention TEXT;
  _tagged_user_id UUID;
  _poster_display_name TEXT;
  _poster_username TEXT;
BEGIN
  -- Emit the original photo_posted event for the poster
  INSERT INTO public.activity_events (user_id, event_type, metadata)
  VALUES (
    NEW.user_id,
    'photo_posted',
    jsonb_build_object(
      'photo_id', NEW.id,
      'image_url', NEW.image_url,
      'caption', COALESCE(NEW.caption, ''),
      'media_type', COALESCE(NEW.media_type, 'image'),
      'batch_id', NEW.batch_id
    )
  );

  -- Parse @mentions from caption and create photo_tagged events
  IF NEW.caption IS NOT NULL AND NEW.caption ~ '@\w+' THEN
    -- Get poster info
    SELECT display_name, username INTO _poster_display_name, _poster_username
    FROM public.user_profiles
    WHERE user_id = NEW.user_id;

    FOR _mention IN
      SELECT (regexp_matches(NEW.caption, '@(\w+)', 'g'))[1]
    LOOP
      -- Look up the mentioned user by username
      SELECT user_id INTO _tagged_user_id
      FROM public.user_profiles
      WHERE lower(username) = lower(_mention)
        AND user_id != NEW.user_id;  -- Don't tag yourself

      IF _tagged_user_id IS NOT NULL THEN
        INSERT INTO public.activity_events (user_id, event_type, metadata)
        VALUES (
          _tagged_user_id,
          'photo_tagged',
          jsonb_build_object(
            'photo_id', NEW.id,
            'image_url', NEW.image_url,
            'caption', COALESCE(NEW.caption, ''),
            'media_type', COALESCE(NEW.media_type, 'image'),
            'batch_id', NEW.batch_id,
            'tagged_by_user_id', NEW.user_id,
            'tagged_by_display_name', COALESCE(_poster_display_name, 'Someone'),
            'tagged_by_username', _poster_username
          )
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;
