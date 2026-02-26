
-- Table to persist per-user dashboard customizations (tab order, hidden tabs, widget order/visibility/sizes)
CREATE TABLE IF NOT EXISTS public.user_dashboard_prefs (
  user_id UUID NOT NULL PRIMARY KEY,
  tab_order TEXT[] NOT NULL DEFAULT '{}',
  hidden_tabs TEXT[] NOT NULL DEFAULT '{}',
  widget_order JSONB NOT NULL DEFAULT '{}',
  hidden_widgets JSONB NOT NULL DEFAULT '{}',
  widget_sizes JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.user_dashboard_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own prefs" ON public.user_dashboard_prefs;
CREATE POLICY "Users can read own prefs"
  ON public.user_dashboard_prefs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own prefs" ON public.user_dashboard_prefs;
CREATE POLICY "Users can insert own prefs"
  ON public.user_dashboard_prefs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own prefs" ON public.user_dashboard_prefs;
CREATE POLICY "Users can update own prefs"
  ON public.user_dashboard_prefs FOR UPDATE
  USING (auth.uid() = user_id);

-- Index not needed since user_id is PK
