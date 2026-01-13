-- Ensure unaccent is available for nicer slugs (handles Café -> cafe)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Slugify helper
CREATE OR REPLACE FUNCTION public.slugify(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' from regexp_replace(
    regexp_replace(lower(unaccent(coalesce(input, ''))), '[^a-z0-9]+', '-', 'g'),
    '-{2,}', '-', 'g'
  ));
$$;

-- Trigger function to set slug when missing
CREATE OR REPLACE FUNCTION public.games_set_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    NEW.slug := public.slugify(NEW.title);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_games_set_slug ON public.games;
CREATE TRIGGER trg_games_set_slug
BEFORE INSERT OR UPDATE OF title, slug
ON public.games
FOR EACH ROW
EXECUTE FUNCTION public.games_set_slug();

-- Backfill missing slugs
UPDATE public.games
SET slug = public.slugify(title)
WHERE slug IS NULL OR btrim(slug) = '';
