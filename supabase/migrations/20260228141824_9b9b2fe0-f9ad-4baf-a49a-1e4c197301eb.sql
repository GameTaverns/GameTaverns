
-- When a photo is deleted, also remove its corresponding activity_event
CREATE OR REPLACE FUNCTION public.cleanup_photo_activity_event()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.activity_events
  WHERE user_id = OLD.user_id
    AND event_type = 'photo_posted'
    AND metadata->>'photo_id' = OLD.id::text;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS on_photo_deleted ON public.user_photos;
CREATE TRIGGER on_photo_deleted
  AFTER DELETE ON public.user_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_photo_activity_event();
