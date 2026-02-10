-- Fix notify_on_loan_status_change: 'rejected' is not a valid loan_status, should be 'declined'
CREATE OR REPLACE FUNCTION public.notify_on_loan_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  game_title text;
  lender_name text;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  SELECT title INTO game_title FROM games WHERE id = NEW.game_id;
  SELECT display_name INTO lender_name FROM user_profiles WHERE user_id = NEW.lender_user_id;
  
  IF NEW.status = 'approved' THEN
    PERFORM create_notification(
      NEW.borrower_user_id,
      'loan_approved',
      'Your loan request was approved!',
      '"' || COALESCE(game_title, 'Unknown Game') || '" from ' || COALESCE(lender_name, 'the lender'),
      jsonb_build_object('loan_id', NEW.id, 'game_id', NEW.game_id)
    );
  ELSIF NEW.status = 'returned' THEN
    PERFORM create_notification(
      NEW.lender_user_id,
      'loan_returned',
      'A borrowed game has been returned',
      '"' || COALESCE(game_title, 'Unknown Game') || '"',
      jsonb_build_object('loan_id', NEW.id, 'game_id', NEW.game_id)
    );
  ELSIF NEW.status = 'declined' THEN
    PERFORM create_notification(
      NEW.borrower_user_id,
      'loan_declined',
      'Your loan request was declined',
      '"' || COALESCE(game_title, 'Unknown Game') || '"',
      jsonb_build_object('loan_id', NEW.id, 'game_id', NEW.game_id)
    );
  END IF;
  
  RETURN NEW;
END;
$function$;