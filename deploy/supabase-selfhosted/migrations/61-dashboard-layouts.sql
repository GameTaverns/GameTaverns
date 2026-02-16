-- Dashboard layout configuration (single row, admin-managed)
CREATE TABLE IF NOT EXISTS public.dashboard_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;

-- Anyone can read the layout (needed for dashboard rendering)
DO $$ BEGIN
  CREATE POLICY "Anyone can view dashboard layout"
  ON public.dashboard_layouts FOR SELECT
  USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Only admins can modify
DO $$ BEGIN
  CREATE POLICY "Admins can manage dashboard layout"
  ON public.dashboard_layouts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Insert default layout if none exists
INSERT INTO public.dashboard_layouts (config)
SELECT '{
  "tabs": [
    {
      "id": "overview",
      "label": "Overview",
      "icon": "Activity",
      "widgets": [
        "import-progress", "onboarding", "lending", "messages", "borrowed",
        "communities", "achievements", "shelf-of-shame", "events", "polls",
        "inquiries", "explore", "ratings-wishlist", "challenges", "random-picker",
        "create-library"
      ]
    },
    {
      "id": "community",
      "label": "Community",
      "icon": "MessageSquare",
      "widgets": ["forums", "clubs", "community-members"]
    },
    {
      "id": "more",
      "label": "More",
      "icon": "Zap",
      "widgets": ["trades", "analytics", "catalog", "account-settings", "danger-zone"]
    }
  ]
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.dashboard_layouts);
