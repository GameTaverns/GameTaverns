-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to dispatch push notifications via the edge function
CREATE OR REPLACE FUNCTION public.dispatch_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _supabase_url TEXT;
  _anon_key TEXT;
BEGIN
  -- Get Supabase URL and anon key from vault or hardcode for cloud
  _supabase_url := current_setting('app.settings.supabase_url', true);
  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  
  -- Fallback: use the known cloud values if settings not available
  IF _supabase_url IS NULL OR _supabase_url = '' THEN
    _supabase_url := 'https://ddfslywzgddlpmkhohfu.supabase.co';
  END IF;
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkZnNseXd6Z2RkbHBta2hvaGZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1Nzk2OTgsImV4cCI6MjA4NTE1NTY5OH0.nRCZpUKD51E3rDJgBU3CCQahraY1Hhvdg__tUHRrFe4';
  END IF;

  -- Fire-and-forget HTTP POST to the edge function
  PERFORM net.http_post(
    url := _supabase_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'record', jsonb_build_object(
        'user_id', NEW.user_id,
        'title', NEW.title,
        'body', NEW.body,
        'notification_type', NEW.notification_type,
        'metadata', NEW.metadata
      )
    )
  );

  RETURN NEW;
END;
$function$;

-- Trigger on notification_log inserts
DROP TRIGGER IF EXISTS trigger_push_notification ON public.notification_log;
CREATE TRIGGER trigger_push_notification
  AFTER INSERT ON public.notification_log
  FOR EACH ROW
  EXECUTE FUNCTION public.dispatch_push_notification();