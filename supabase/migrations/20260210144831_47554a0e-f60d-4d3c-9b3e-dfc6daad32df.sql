CREATE OR REPLACE FUNCTION public.notify_on_loan_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  game_title text;
  borrower_name text;
BEGIN
  -- Only notify on new loan requests
  IF TG_OP = 'INSERT' AND NEW.status = 'requested' THEN
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
$function$;