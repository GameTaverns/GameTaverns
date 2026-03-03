
-- Add year_published column to games table
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS year_published integer;

-- Backfill from linked game_catalog entries
UPDATE public.games g
SET year_published = gc.year_published
FROM public.game_catalog gc
WHERE g.catalog_id = gc.id
  AND gc.year_published IS NOT NULL
  AND g.year_published IS NULL;

-- Create a trigger to auto-sync year_published when catalog_id is set/updated
CREATE OR REPLACE FUNCTION public.sync_game_year_from_catalog()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.catalog_id IS NOT NULL AND (OLD IS NULL OR OLD.catalog_id IS DISTINCT FROM NEW.catalog_id OR NEW.year_published IS NULL) THEN
    SELECT gc.year_published INTO NEW.year_published
    FROM public.game_catalog gc
    WHERE gc.id = NEW.catalog_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_year_from_catalog
BEFORE INSERT OR UPDATE ON public.games
FOR EACH ROW
EXECUTE FUNCTION public.sync_game_year_from_catalog();
