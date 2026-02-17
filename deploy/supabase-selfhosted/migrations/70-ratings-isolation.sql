-- Migration 70: Ratings isolation (source column + catalog_ratings table)
SET LOCAL lock_timeout = '5s';

-- 1. Add 'source' column to game_ratings
ALTER TABLE public.game_ratings ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'visitor';

-- Update existing bgg-community ratings to have source = 'bgg'
UPDATE public.game_ratings SET source = 'bgg' WHERE guest_identifier = 'bgg-community';

CREATE INDEX IF NOT EXISTS idx_game_ratings_source ON public.game_ratings(source);

-- 2. Recreate summary view — only includes visitor + bgg-user ratings (excludes old bgg-community)
DROP VIEW IF EXISTS public.game_ratings_summary;
CREATE VIEW public.game_ratings_summary WITH (security_invoker=on) AS
  SELECT game_id,
    round(avg(rating), 1) AS average_rating,
    (count(*))::integer AS rating_count,
    round(avg(rating) FILTER (WHERE source = 'visitor'), 1) AS visitor_average,
    (count(*) FILTER (WHERE source = 'visitor'))::integer AS visitor_count,
    round(avg(rating) FILTER (WHERE source = 'bgg-user'), 1) AS bgg_user_average,
    (count(*) FILTER (WHERE source = 'bgg-user'))::integer AS bgg_user_count
  FROM game_ratings
  WHERE source IN ('visitor', 'bgg-user')
  GROUP BY game_id;
GRANT SELECT ON public.game_ratings_summary TO anon, authenticated;

-- Delete old bgg-community ratings from library game_ratings
DELETE FROM public.game_ratings WHERE guest_identifier = 'bgg-community';

-- Recreate library view to include source
DROP VIEW IF EXISTS public.game_ratings_library_view;
CREATE VIEW public.game_ratings_library_view WITH (security_invoker=on) AS
  SELECT id, game_id, guest_identifier, rating, source, created_at, updated_at
  FROM game_ratings;
GRANT SELECT ON public.game_ratings_library_view TO anon, authenticated;

-- 3. Create catalog_ratings table
CREATE TABLE IF NOT EXISTS public.catalog_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id UUID NOT NULL REFERENCES public.game_catalog(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  guest_identifier TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'visitor',
  ip_address TEXT,
  device_fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(catalog_id, guest_identifier)
);

CREATE INDEX IF NOT EXISTS idx_catalog_ratings_catalog_id ON public.catalog_ratings(catalog_id);
CREATE INDEX IF NOT EXISTS idx_catalog_ratings_source ON public.catalog_ratings(source);

ALTER TABLE public.catalog_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Catalog ratings are publicly readable" ON public.catalog_ratings;
CREATE POLICY "Catalog ratings are publicly readable"
  ON public.catalog_ratings FOR SELECT USING (true);

-- Summary view for catalog ratings
DROP VIEW IF EXISTS public.catalog_ratings_summary;
CREATE VIEW public.catalog_ratings_summary WITH (security_invoker=on) AS
  SELECT catalog_id,
    round(avg(rating), 1) AS average_rating,
    (count(*))::integer AS rating_count,
    round(avg(rating) FILTER (WHERE source = 'visitor'), 1) AS visitor_average,
    (count(*) FILTER (WHERE source = 'visitor'))::integer AS visitor_count
  FROM catalog_ratings
  GROUP BY catalog_id;
GRANT SELECT ON public.catalog_ratings_summary TO anon, authenticated;
