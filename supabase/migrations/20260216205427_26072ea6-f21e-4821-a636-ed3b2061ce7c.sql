
-- =============================================================================
-- Catalog Scraper State Tracking
-- Tracks the automated BGG catalog scraping progress
-- =============================================================================

CREATE TABLE public.catalog_scraper_state (
  id text PRIMARY KEY DEFAULT 'default',
  next_bgg_id integer NOT NULL DEFAULT 1,
  total_processed integer NOT NULL DEFAULT 0,
  total_added integer NOT NULL DEFAULT 0,
  total_skipped integer NOT NULL DEFAULT 0,
  total_errors integer NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed initial state row
INSERT INTO public.catalog_scraper_state (id, next_bgg_id, is_enabled) VALUES ('default', 1, false);

-- RLS: only admins via service role
ALTER TABLE public.catalog_scraper_state ENABLE ROW LEVEL SECURITY;

-- Allow admins to read via service role (edge function uses service role)
CREATE POLICY "Service role full access" ON public.catalog_scraper_state
  FOR ALL USING (true) WITH CHECK (true);
