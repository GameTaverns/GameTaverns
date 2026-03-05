-- Ensure dashboard preferences table exists (for self-hosted parity)
CREATE TABLE IF NOT EXISTS public.user_dashboard_prefs (
  user_id uuid PRIMARY KEY,
  tab_order text[] NOT NULL DEFAULT '{}'::text[],
  hidden_tabs text[] NOT NULL DEFAULT '{}'::text[],
  widget_order jsonb NOT NULL DEFAULT '{}'::jsonb,
  hidden_widgets jsonb NOT NULL DEFAULT '{}'::jsonb,
  widget_sizes jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_dashboard_prefs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_dashboard_prefs'
      AND policyname = 'Users can read own prefs'
  ) THEN
    CREATE POLICY "Users can read own prefs"
      ON public.user_dashboard_prefs
      FOR SELECT
      TO public
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_dashboard_prefs'
      AND policyname = 'Users can insert own prefs'
  ) THEN
    CREATE POLICY "Users can insert own prefs"
      ON public.user_dashboard_prefs
      FOR INSERT
      TO public
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_dashboard_prefs'
      AND policyname = 'Users can update own prefs'
  ) THEN
    CREATE POLICY "Users can update own prefs"
      ON public.user_dashboard_prefs
      FOR UPDATE
      TO public
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Ensure library view tracking table exists
CREATE TABLE IF NOT EXISTS public.library_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  viewer_hash text,
  page_path text DEFAULT '/'::text,
  referrer text
);

-- Add FK only if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'library_views_library_id_fkey'
  ) THEN
    ALTER TABLE public.library_views
      ADD CONSTRAINT library_views_library_id_fkey
      FOREIGN KEY (library_id)
      REFERENCES public.libraries(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_library_views_library_id ON public.library_views(library_id);
CREATE INDEX IF NOT EXISTS idx_library_views_viewed_at ON public.library_views(viewed_at DESC);

ALTER TABLE public.library_views ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'library_views'
      AND policyname = 'Anyone can record a view'
  ) THEN
    CREATE POLICY "Anyone can record a view"
      ON public.library_views
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'library_views'
      AND policyname = 'Library owners can read their views'
  ) THEN
    CREATE POLICY "Library owners can read their views"
      ON public.library_views
      FOR SELECT
      TO authenticated
      USING (public.is_library_member(auth.uid(), library_id));
  END IF;
END $$;

-- Recreate stats view idempotently
CREATE OR REPLACE VIEW public.library_view_stats
WITH (security_invoker=on) AS
SELECT
  library_id,
  COUNT(*) FILTER (WHERE viewed_at > now() - interval '7 days') AS views_7d,
  COUNT(*) FILTER (WHERE viewed_at > now() - interval '30 days') AS views_30d,
  COUNT(DISTINCT viewer_hash) FILTER (WHERE viewed_at > now() - interval '7 days') AS unique_viewers_7d,
  COUNT(DISTINCT viewer_hash) FILTER (WHERE viewed_at > now() - interval '30 days') AS unique_viewers_30d,
  COUNT(*) AS views_total
FROM public.library_views
GROUP BY library_id;