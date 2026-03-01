
CREATE TABLE IF NOT EXISTS public.reengagement_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('sent', 'opened', 'clicked', 'unsubscribed')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reengagement_events_type ON public.reengagement_email_events(event_type);
CREATE INDEX idx_reengagement_events_created ON public.reengagement_email_events(created_at);
CREATE INDEX idx_reengagement_events_user ON public.reengagement_email_events(user_id);

ALTER TABLE public.reengagement_email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email events"
ON public.reengagement_email_events FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert email events"
ON public.reengagement_email_events FOR INSERT
WITH CHECK (true);
