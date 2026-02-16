
-- Add trigger to seed forum categories when a club is approved
CREATE OR REPLACE FUNCTION seed_club_forum_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only seed when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    PERFORM seed_club_forum_categories(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_seed_club_forum_on_approval') THEN
    CREATE TRIGGER trigger_seed_club_forum_on_approval
      AFTER UPDATE ON public.clubs
      FOR EACH ROW
      EXECUTE FUNCTION seed_club_forum_on_approval();
  END IF;
END $$;

-- Also remove marketplace from the site-wide forum seeding function so future re-seeds don't re-add it
-- (The actual data was already deleted above)

NOTIFY pgrst, 'reload schema';
