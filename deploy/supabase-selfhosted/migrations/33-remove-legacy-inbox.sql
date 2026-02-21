-- =============================================================================
-- GameTaverns Self-Hosted: Remove Legacy Inbox (game_messages)
-- Migration: 33-remove-legacy-inbox.sql
-- All messaging now unified under direct_messages
-- =============================================================================

-- Drop triggers first
DROP TRIGGER IF EXISTS notify_on_game_message_trigger ON public.game_messages;

-- Remove from realtime publication
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.game_messages;
    EXCEPTION WHEN undefined_object THEN
        RAISE NOTICE 'game_messages not in supabase_realtime publication';
    END;
END $$;

-- Drop dependent table first
DROP TABLE IF EXISTS public.game_message_replies CASCADE;
DROP TABLE IF EXISTS public.game_messages CASCADE;
