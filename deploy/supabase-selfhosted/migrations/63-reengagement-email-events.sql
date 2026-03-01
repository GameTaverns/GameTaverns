-- =============================================================================
-- Re-engagement Email Event Tracking
-- Version: 2.11.0
--
-- Tracks full funnel: sent, opened, clicked, unsubscribed
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.reengagement_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('sent', 'opened', 'clicked', 'unsubscribed')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reengagement_events_type ON public.reengagement_email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_reengagement_events_created ON public.reengagement_email_events(created_at);
CREATE INDEX IF NOT EXISTS idx_reengagement_events_user ON public.reengagement_email_events(user_id);

ALTER TABLE public.reengagement_email_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins can view email events"
  ON public.reengagement_email_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert email events"
  ON public.reengagement_email_events FOR INSERT
  WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT ALL ON public.reengagement_email_events TO authenticated, service_role, anon;

NOTIFY pgrst, 'reload schema';
