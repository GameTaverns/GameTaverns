-- =============================================================================
-- Catalog Scraper State Tracking + Cron Job
-- Version: 3.0.0
--
-- Weekly sweep mode: scans forward from the max known BGG ID to catch
-- newly published games. No more grinding through millions of dead IDs.
-- =============================================================================

-- State tracking table
CREATE TABLE IF NOT EXISTS public.catalog_scraper_state (
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

-- Seed initial state
INSERT INTO public.catalog_scraper_state (id, next_bgg_id, is_enabled)
VALUES ('default', 1, false)
ON CONFLICT (id) DO NOTHING;

-- Grants (required for PostgREST visibility)
GRANT ALL ON public.catalog_scraper_state TO authenticated, service_role, anon;

-- RLS
ALTER TABLE public.catalog_scraper_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.catalog_scraper_state
  FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────
-- Unschedule the old every-2-minute sequential scraper
-- ─────────────────────────────────────────────────────────────────────
SELECT cron.unschedule('catalog-scraper-cron')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'catalog-scraper-cron');

-- ─────────────────────────────────────────────────────────────────────
-- Weekly sweep: Sundays at 1 AM — scan forward from max known BGG ID
-- to catch newly published games. Lightweight and targeted.
-- ─────────────────────────────────────────────────────────────────────
SELECT cron.unschedule('catalog-scraper-sweep')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'catalog-scraper-sweep');

SELECT cron.schedule(
  'catalog-scraper-sweep',
  '0 1 * * 0',
  $$
  SELECT net.http_post(
    url := 'http://kong:8000/functions/v1/catalog-scraper',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"action":"sweep","batches":25,"forward_buffer":5000}'::jsonb
  );
  $$
);
