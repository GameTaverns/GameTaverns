-- Update the activity trigger to include batch_id in metadata
CREATE OR REPLACE FUNCTION public.emit_activity_photo_posted()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
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
  RETURN NEW;
END;
$function$;