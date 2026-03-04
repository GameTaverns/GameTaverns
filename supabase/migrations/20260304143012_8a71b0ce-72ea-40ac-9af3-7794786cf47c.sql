
-- Track anonymous page views on public library pages
CREATE TABLE public.library_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id uuid NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  viewer_hash text, -- anonymous hash of IP for dedup, no PII stored
  page_path text DEFAULT '/',
  referrer text
);

-- Index for efficient queries by library and time
CREATE INDEX idx_library_views_library_date ON public.library_views (library_id, viewed_at DESC);

-- Enable RLS
ALTER TABLE public.library_views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (anonymous visitors)
CREATE POLICY "Anyone can record a view"
  ON public.library_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only library owners/members can read their own view stats
CREATE POLICY "Library owners can read their views"
  ON public.library_views FOR SELECT
  TO authenticated
  USING (public.is_library_member(auth.uid(), library_id));

-- Aggregate view for dashboard (avoids scanning raw rows)
CREATE OR REPLACE VIEW public.library_view_stats AS
SELECT
  library_id,
  COUNT(*) FILTER (WHERE viewed_at > now() - interval '7 days') AS views_7d,
  COUNT(*) FILTER (WHERE viewed_at > now() - interval '30 days') AS views_30d,
  COUNT(DISTINCT viewer_hash) FILTER (WHERE viewed_at > now() - interval '7 days') AS unique_viewers_7d,
  COUNT(DISTINCT viewer_hash) FILTER (WHERE viewed_at > now() - interval '30 days') AS unique_viewers_30d,
  COUNT(*) AS views_total
FROM public.library_views
GROUP BY library_id;
