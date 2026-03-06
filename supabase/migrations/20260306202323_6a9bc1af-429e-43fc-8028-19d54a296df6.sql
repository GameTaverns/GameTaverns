
CREATE OR REPLACE FUNCTION public.validate_club_loan_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_copies_owned INTEGER;
  v_active_loans INTEGER;
  v_copy_already_out BOOLEAN;
BEGIN
  -- If a specific copy is specified, check if that copy is already checked out
  IF NEW.copy_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.club_loans
      WHERE club_id = NEW.club_id
        AND copy_id = NEW.copy_id
        AND status = 'checked_out'
    ) INTO v_copy_already_out;
    
    IF v_copy_already_out THEN
      RAISE EXCEPTION 'This copy is already checked out';
    END IF;
  END IF;

  -- Check total active loans vs copies_owned
  SELECT COALESCE(g.copies_owned, 1) INTO v_copies_owned
  FROM public.games g
  WHERE g.id = NEW.game_id;

  SELECT COUNT(*) INTO v_active_loans
  FROM public.club_loans
  WHERE club_id = NEW.club_id
    AND game_id = NEW.game_id
    AND status = 'checked_out';

  IF v_active_loans >= v_copies_owned THEN
    RAISE EXCEPTION 'All copies of this game are already checked out (% of % in use)', v_active_loans, v_copies_owned;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_club_loan_availability ON public.club_loans;
CREATE TRIGGER trg_validate_club_loan_availability
  BEFORE INSERT ON public.club_loans
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_club_loan_availability();
