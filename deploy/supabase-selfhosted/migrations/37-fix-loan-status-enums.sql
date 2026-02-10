-- =============================================================================
-- GameTaverns Self-Hosted: Fix loan_status enum parity with Cloud
-- 
-- Self-hosted enum had 'borrowed' but code/Cloud uses 'active'.
-- Also fixes notify_on_loan_status_change() which referenced 'rejected'
-- instead of the correct enum value 'declined'.
-- =============================================================================

-- 1) Rename 'borrowed' → 'active' (skip if already renamed)
DO $$ BEGIN
    ALTER TYPE loan_status RENAME VALUE 'borrowed' TO 'active';
EXCEPTION WHEN invalid_parameter_value THEN
    -- Already renamed, nothing to do
    NULL;
END $$;

-- 2) Fix the loan status change notification trigger
--    It was checking for 'rejected' which is not a valid loan_status value.
--    The correct value is 'declined'.
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
  
  -- Loan declined (was incorrectly 'rejected')
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
