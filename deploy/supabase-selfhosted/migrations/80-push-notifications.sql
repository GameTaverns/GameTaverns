-- =============================================================================
-- Push Notifications Infrastructure for Self-Hosted
-- Version: 80
-- Creates user_push_tokens table, enables pg_net, and wires the dispatch trigger
-- =============================================================================

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. ENABLE pg_net EXTENSION (for HTTP calls from triggers)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- 2. USER PUSH TOKENS TABLE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android',
  device_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON public.user_push_tokens(user_id);

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view their own push tokens"
    ON public.user_push_tokens FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert their own push tokens"
    ON public.user_push_tokens FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own push tokens"
    ON public.user_push_tokens FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own push tokens"
    ON public.user_push_tokens FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service role needs full access for the edge function to clean stale tokens
DO $$ BEGIN
  CREATE POLICY "Service role full access to push tokens"
    ON public.user_push_tokens FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_push_tokens TO authenticated;
GRANT ALL ON public.user_push_tokens TO service_role;

-- ---------------------------------------------------------------------------
-- 3. DISPATCH PUSH NOTIFICATION TRIGGER
-- Uses pg_net to fire-and-forget HTTP POST to the edge function
-- when a notification is inserted into notification_log.
-- Uses app.settings for self-hosted URL configuration.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.dispatch_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _supabase_url TEXT;
  _anon_key TEXT;
BEGIN
  -- Read from app.settings (set in docker-compose or postgresql.conf)
  _supabase_url := current_setting('app.settings.supabase_url', true);
  _anon_key := current_setting('app.settings.supabase_anon_key', true);

  -- Skip if not configured (avoids errors on unconfigured instances)
  IF _supabase_url IS NULL OR _supabase_url = '' THEN
    RAISE WARNING 'dispatch_push_notification: app.settings.supabase_url not set, skipping';
    RETURN NEW;
  END IF;
  IF _anon_key IS NULL OR _anon_key = '' THEN
    RAISE WARNING 'dispatch_push_notification: app.settings.supabase_anon_key not set, skipping';
    RETURN NEW;
  END IF;

  -- Fire-and-forget HTTP POST to the send-push-notification edge function
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
$$;

-- Attach trigger to notification_log
DROP TRIGGER IF EXISTS trg_dispatch_push ON public.notification_log;
CREATE TRIGGER trg_dispatch_push
  AFTER INSERT ON public.notification_log
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_notification();
