-- =============================================================================
-- GameTaverns Self-Hosted: Notifications System & Realtime
-- Migration: 23-notifications-realtime.sql
-- Adds notification triggers, realtime subscriptions, and RLS policies
-- =============================================================================

-- ===========================================
-- Notification Helper Function
-- ===========================================
CREATE OR REPLACE FUNCTION public.create_notification(
    _user_id uuid, 
    _type text, 
    _title text, 
    _body text DEFAULT NULL, 
    _metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    notification_id uuid;
BEGIN
    INSERT INTO public.notification_log (user_id, notification_type, channel, title, body, metadata, sent_at)
    VALUES (_user_id, _type, 'in_app', _title, _body, _metadata, now())
    RETURNING id INTO notification_id;
    
    RETURN notification_id;
END;
$$;

-- ===========================================
-- Forum Reply Notification Trigger
-- ===========================================
CREATE OR REPLACE FUNCTION public.notify_on_forum_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    thread_author_id uuid;
    thread_title text;
    replier_name text;
BEGIN
    -- Get thread author and title
    SELECT author_id, title INTO thread_author_id, thread_title
    FROM public.forum_threads
    WHERE id = NEW.thread_id;
    
    -- Don't notify if replying to own thread
    IF thread_author_id = NEW.author_id THEN
        RETURN NEW;
    END IF;
    
    -- Get replier display name
    SELECT display_name INTO replier_name
    FROM public.user_profiles
    WHERE user_id = NEW.author_id;
    
    -- Create notification for thread author
    PERFORM public.create_notification(
        thread_author_id,
        'forum_reply',
        COALESCE(replier_name, 'Someone') || ' replied to your thread',
        '"' || LEFT(thread_title, 50) || CASE WHEN LENGTH(thread_title) > 50 THEN '...' ELSE '' END || '"',
        jsonb_build_object('thread_id', NEW.thread_id, 'reply_id', NEW.id)
    );
    
    RETURN NEW;
END;
$$;

-- Create trigger for forum reply notifications
DROP TRIGGER IF EXISTS notify_on_forum_reply_trigger ON public.forum_replies;
CREATE TRIGGER notify_on_forum_reply_trigger
    AFTER INSERT ON public.forum_replies
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_on_forum_reply();

-- ===========================================
-- Loan Request Notification Trigger
-- ===========================================
CREATE OR REPLACE FUNCTION public.notify_on_loan_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    game_title text;
    borrower_name text;
BEGIN
    -- Only notify on new loan requests
    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
        -- Get game title
        SELECT title INTO game_title FROM public.games WHERE id = NEW.game_id;
        
        -- Get borrower name
        SELECT display_name INTO borrower_name
        FROM public.user_profiles WHERE user_id = NEW.borrower_user_id;
        
        -- Notify the lender
        PERFORM public.create_notification(
            NEW.lender_user_id,
            'loan_request',
            COALESCE(borrower_name, 'Someone') || ' requested to borrow a game',
            '"' || COALESCE(game_title, 'Unknown Game') || '"',
            jsonb_build_object('loan_id', NEW.id, 'game_id', NEW.game_id)
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for loan request notifications
DROP TRIGGER IF EXISTS notify_on_loan_request_trigger ON public.game_loans;
CREATE TRIGGER notify_on_loan_request_trigger
    AFTER INSERT ON public.game_loans
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_on_loan_request();

-- ===========================================
-- Loan Status Change Notification Trigger
-- ===========================================
CREATE OR REPLACE FUNCTION public.notify_on_loan_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    game_title text;
    lender_name text;
BEGIN
    -- Only on status changes
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    SELECT title INTO game_title FROM public.games WHERE id = NEW.game_id;
    SELECT display_name INTO lender_name FROM public.user_profiles WHERE user_id = NEW.lender_user_id;
    
    -- Loan approved
    IF NEW.status = 'approved' THEN
        PERFORM public.create_notification(
            NEW.borrower_user_id,
            'loan_approved',
            'Your loan request was approved!',
            '"' || COALESCE(game_title, 'Unknown Game') || '" from ' || COALESCE(lender_name, 'the lender'),
            jsonb_build_object('loan_id', NEW.id, 'game_id', NEW.game_id)
        );
    
    -- Loan returned
    ELSIF NEW.status = 'returned' THEN
        PERFORM public.create_notification(
            NEW.lender_user_id,
            'loan_returned',
            'A borrowed game has been returned',
            '"' || COALESCE(game_title, 'Unknown Game') || '"',
            jsonb_build_object('loan_id', NEW.id, 'game_id', NEW.game_id)
        );
    
    -- Loan rejected
    ELSIF NEW.status = 'rejected' THEN
        PERFORM public.create_notification(
            NEW.borrower_user_id,
            'loan_rejected',
            'Your loan request was declined',
            '"' || COALESCE(game_title, 'Unknown Game') || '"',
            jsonb_build_object('loan_id', NEW.id, 'game_id', NEW.game_id)
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for loan status change notifications
DROP TRIGGER IF EXISTS notify_on_loan_status_change_trigger ON public.game_loans;
CREATE TRIGGER notify_on_loan_status_change_trigger
    AFTER UPDATE ON public.game_loans
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_on_loan_status_change();

-- ===========================================
-- Achievement Earned Notification Trigger
-- ===========================================
CREATE OR REPLACE FUNCTION public.notify_on_achievement_earned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    achievement_name text;
    achievement_icon text;
BEGIN
    -- Get achievement details
    SELECT name, icon INTO achievement_name, achievement_icon
    FROM public.achievements WHERE id = NEW.achievement_id;
    
    -- Create notification
    PERFORM public.create_notification(
        NEW.user_id,
        'achievement_earned',
        'Achievement Unlocked! ' || COALESCE(achievement_icon, '🏆'),
        'You earned "' || COALESCE(achievement_name, 'Unknown Achievement') || '"',
        jsonb_build_object('achievement_id', NEW.achievement_id)
    );
    
    RETURN NEW;
END;
$$;

-- Create trigger for achievement notifications
DROP TRIGGER IF EXISTS notify_on_achievement_earned_trigger ON public.user_achievements;
CREATE TRIGGER notify_on_achievement_earned_trigger
    AFTER INSERT ON public.user_achievements
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_on_achievement_earned();

-- ===========================================
-- RLS Policies for notification_log
-- ===========================================
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notification_log;
CREATE POLICY "Users can view own notifications"
    ON public.notification_log FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notification_log;
CREATE POLICY "Users can update own notifications"
    ON public.notification_log FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert notifications" ON public.notification_log;
CREATE POLICY "System can insert notifications"
    ON public.notification_log FOR INSERT
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT, UPDATE ON public.notification_log TO authenticated;
GRANT INSERT ON public.notification_log TO authenticated;

-- ===========================================
-- Enable Realtime for Tables
-- ===========================================
-- Self-hosted Supabase may not have the realtime publication created yet.
-- We create it if missing, then add tables to it.

DO $$
BEGIN
    -- Create the publication if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
        RAISE NOTICE 'Created supabase_realtime publication';
    END IF;
END $$;

-- Add tables to realtime publication (safe even if already added)
DO $$
BEGIN
    -- Enable realtime for notification_log
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_log;
        RAISE NOTICE 'Added notification_log to supabase_realtime publication';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'notification_log already in supabase_realtime publication';
    WHEN undefined_table THEN
        RAISE NOTICE 'notification_log table does not exist yet';
    END;

    -- Enable realtime for forum_threads
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_threads;
        RAISE NOTICE 'Added forum_threads to supabase_realtime publication';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'forum_threads already in supabase_realtime publication';
    WHEN undefined_table THEN
        RAISE NOTICE 'forum_threads table does not exist yet';
    END;

    -- Enable realtime for forum_replies
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_replies;
        RAISE NOTICE 'Added forum_replies to supabase_realtime publication';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'forum_replies already in supabase_realtime publication';
    WHEN undefined_table THEN
        RAISE NOTICE 'forum_replies table does not exist yet';
    END;
END $$;
