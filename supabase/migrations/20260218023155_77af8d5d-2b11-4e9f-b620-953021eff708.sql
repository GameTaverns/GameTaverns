
-- =============================================================================
-- Phase 3 Social Layer: Direct Messages, Activity Reactions, User Presence
-- Version: 71
-- =============================================================================

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. DIRECT MESSAGES
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  deleted_by_sender BOOLEAN NOT NULL DEFAULT false,
  deleted_by_recipient BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (sender_id != recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_sender ON public.direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_dm_recipient ON public.direct_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_dm_created ON public.direct_messages(created_at DESC);
-- Composite for conversation lookup
CREATE INDEX IF NOT EXISTS idx_dm_conversation ON public.direct_messages(
  LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id), created_at DESC
);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view their own DMs"
    ON public.direct_messages FOR SELECT
    TO authenticated
    USING (
      (auth.uid() = sender_id AND NOT deleted_by_sender) OR
      (auth.uid() = recipient_id AND NOT deleted_by_recipient)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can send DMs"
    ON public.direct_messages FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = sender_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can soft-delete their own DMs"
    ON public.direct_messages FOR UPDATE
    TO authenticated
    USING (auth.uid() = sender_id OR auth.uid() = recipient_id)
    WITH CHECK (auth.uid() = sender_id OR auth.uid() = recipient_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 2. ACTIVITY REACTIONS (likes on activity_events)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.activity_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  user_id UUID NOT NULL,
  reaction_type TEXT NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_activity_reactions_event ON public.activity_reactions(event_id);
CREATE INDEX IF NOT EXISTS idx_activity_reactions_user ON public.activity_reactions(user_id);

ALTER TABLE public.activity_reactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Reactions are publicly readable"
    ON public.activity_reactions FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can react to events"
    ON public.activity_reactions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can remove their own reactions"
    ON public.activity_reactions FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 3. USER PRESENCE (online / idle / offline)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'idle', 'offline')),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Presence is publicly readable"
    ON public.user_presence FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can upsert their own presence"
    ON public.user_presence FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own presence"
    ON public.user_presence FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 4. DB TRIGGERS: notify on new follow & new DM
-- ---------------------------------------------------------------------------

-- Notify the followed user when someone follows them
CREATE OR REPLACE FUNCTION public.notify_on_new_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  follower_name TEXT;
  follower_username TEXT;
BEGIN
  SELECT display_name, username INTO follower_name, follower_username
  FROM public.user_profiles WHERE user_id = NEW.follower_id;

  PERFORM public.create_notification(
    NEW.following_id,
    'new_follower',
    COALESCE(follower_name, 'Someone') || ' started following you',
    NULL,
    jsonb_build_object('follower_id', NEW.follower_id, 'username', follower_username)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_follow ON public.user_follows;
CREATE TRIGGER trg_notify_new_follow
  AFTER INSERT ON public.user_follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_follow();

-- Notify recipient on new DM
CREATE OR REPLACE FUNCTION public.notify_on_new_dm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  sender_name TEXT;
BEGIN
  SELECT display_name INTO sender_name
  FROM public.user_profiles WHERE user_id = NEW.sender_id;

  PERFORM public.create_notification(
    NEW.recipient_id,
    'direct_message',
    COALESCE(sender_name, 'Someone') || ' sent you a message',
    LEFT(NEW.content, 100),
    jsonb_build_object('sender_id', NEW.sender_id, 'message_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_dm ON public.direct_messages;
CREATE TRIGGER trg_notify_new_dm
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_dm();

-- Notify activity event owner when they get a reaction
CREATE OR REPLACE FUNCTION public.notify_on_activity_reaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  event_owner_id UUID;
  reactor_name TEXT;
BEGIN
  SELECT user_id INTO event_owner_id FROM public.activity_events WHERE id = NEW.event_id;
  -- Don't notify self-reactions
  IF event_owner_id IS NULL OR event_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO reactor_name FROM public.user_profiles WHERE user_id = NEW.user_id;

  PERFORM public.create_notification(
    event_owner_id,
    'activity_reaction',
    COALESCE(reactor_name, 'Someone') || ' liked your activity',
    NULL,
    jsonb_build_object('event_id', NEW.event_id, 'reactor_id', NEW.user_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_activity_reaction ON public.activity_reactions;
CREATE TRIGGER trg_notify_activity_reaction
  AFTER INSERT ON public.activity_reactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_activity_reaction();
