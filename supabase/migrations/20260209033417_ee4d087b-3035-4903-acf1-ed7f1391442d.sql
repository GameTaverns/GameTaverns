-- Helper function to create notifications
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
  INSERT INTO notification_log (user_id, notification_type, channel, title, body, metadata, sent_at)
  VALUES (_user_id, _type, 'in_app', _title, _body, _metadata, now())
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Trigger for forum reply notifications
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
  FROM forum_threads
  WHERE id = NEW.thread_id;
  
  -- Don't notify if replying to own thread
  IF thread_author_id = NEW.author_id THEN
    RETURN NEW;
  END IF;
  
  -- Get replier display name
  SELECT display_name INTO replier_name
  FROM user_profiles
  WHERE user_id = NEW.author_id;
  
  -- Create notification for thread author
  PERFORM create_notification(
    thread_author_id,
    'forum_reply',
    COALESCE(replier_name, 'Someone') || ' replied to your thread',
    '"' || LEFT(thread_title, 50) || CASE WHEN LENGTH(thread_title) > 50 THEN '...' ELSE '' END || '"',
    jsonb_build_object('thread_id', NEW.thread_id, 'reply_id', NEW.id)
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_forum_reply
AFTER INSERT ON forum_replies
FOR EACH ROW
EXECUTE FUNCTION notify_on_forum_reply();

-- Trigger for lending request notifications
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
    SELECT title INTO game_title FROM games WHERE id = NEW.game_id;
    
    -- Get borrower name
    SELECT display_name INTO borrower_name
    FROM user_profiles WHERE user_id = NEW.borrower_user_id;
    
    -- Notify the lender
    PERFORM create_notification(
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

CREATE TRIGGER trigger_notify_loan_request
AFTER INSERT ON game_loans
FOR EACH ROW
EXECUTE FUNCTION notify_on_loan_request();

-- Trigger for loan status change notifications
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
  
  SELECT title INTO game_title FROM games WHERE id = NEW.game_id;
  SELECT display_name INTO lender_name FROM user_profiles WHERE user_id = NEW.lender_user_id;
  
  -- Loan approved
  IF NEW.status = 'approved' THEN
    PERFORM create_notification(
      NEW.borrower_user_id,
      'loan_approved',
      'Your loan request was approved!',
      '"' || COALESCE(game_title, 'Unknown Game') || '" from ' || COALESCE(lender_name, 'the lender'),
      jsonb_build_object('loan_id', NEW.id, 'game_id', NEW.game_id)
    );
  
  -- Loan returned
  ELSIF NEW.status = 'returned' THEN
    PERFORM create_notification(
      NEW.lender_user_id,
      'loan_returned',
      'A borrowed game has been returned',
      '"' || COALESCE(game_title, 'Unknown Game') || '"',
      jsonb_build_object('loan_id', NEW.id, 'game_id', NEW.game_id)
    );
  
  -- Loan rejected
  ELSIF NEW.status = 'rejected' THEN
    PERFORM create_notification(
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

CREATE TRIGGER trigger_notify_loan_status_change
AFTER UPDATE ON game_loans
FOR EACH ROW
EXECUTE FUNCTION notify_on_loan_status_change();

-- Trigger for achievement unlock notifications
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
  FROM achievements WHERE id = NEW.achievement_id;
  
  -- Create notification
  PERFORM create_notification(
    NEW.user_id,
    'achievement_earned',
    'Achievement Unlocked! ' || COALESCE(achievement_icon, '🏆'),
    'You earned "' || COALESCE(achievement_name, 'Unknown Achievement') || '"',
    jsonb_build_object('achievement_id', NEW.achievement_id)
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_achievement_earned
AFTER INSERT ON user_achievements
FOR EACH ROW
EXECUTE FUNCTION notify_on_achievement_earned();