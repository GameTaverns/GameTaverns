
-- 1. Add 'source' column to game_ratings to isolate rating types
ALTER TABLE public.game_ratings ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'visitor';

-- Update existing bgg-community ratings to have source = 'bgg'
UPDATE public.game_ratings SET source = 'bgg' WHERE guest_identifier = 'bgg-community';

-- Index for efficient source-based filtering
CREATE INDEX IF NOT EXISTS idx_game_ratings_source ON public.game_ratings(source);

-- 2. Recreate the summary view to support filtering by source
DROP VIEW IF EXISTS public.game_ratings_summary;
CREATE VIEW public.game_ratings_summary AS
  SELECT game_id,
    round(avg(rating), 1) AS average_rating,
    (count(*))::integer AS rating_count,
    round(avg(rating) FILTER (WHERE source = 'visitor'), 1) AS visitor_average,
    (count(*) FILTER (WHERE source = 'visitor'))::integer AS visitor_count,
    round(avg(rating) FILTER (WHERE source = 'bgg'), 1) AS bgg_average,
    (count(*) FILTER (WHERE source = 'bgg'))::integer AS bgg_count
  FROM game_ratings
  GROUP BY game_id;

GRANT SELECT ON public.game_ratings_summary TO anon, authenticated;

-- Recreate library view to include source
DROP VIEW IF EXISTS public.game_ratings_library_view;
CREATE VIEW public.game_ratings_library_view AS
  SELECT id, game_id, guest_identifier, rating, source, created_at, updated_at
  FROM game_ratings;

GRANT SELECT ON public.game_ratings_library_view TO anon, authenticated;

-- 3. Create catalog_ratings table for user ratings on catalog games
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

-- Public read access (same pattern as game_ratings)
CREATE POLICY "Catalog ratings are publicly readable"
  ON public.catalog_ratings FOR SELECT USING (true);

-- No direct insert/update/delete — handled via edge function with service role
-- This prevents manipulation while allowing the rate-game function to manage ratings

-- Summary view for catalog ratings
CREATE VIEW public.catalog_ratings_summary AS
  SELECT catalog_id,
    round(avg(rating), 1) AS average_rating,
    (count(*))::integer AS rating_count,
    round(avg(rating) FILTER (WHERE source = 'visitor'), 1) AS visitor_average,
    (count(*) FILTER (WHERE source = 'visitor'))::integer AS visitor_count
  FROM catalog_ratings
  GROUP BY catalog_id;

GRANT SELECT ON public.catalog_ratings_summary TO anon, authenticated;
