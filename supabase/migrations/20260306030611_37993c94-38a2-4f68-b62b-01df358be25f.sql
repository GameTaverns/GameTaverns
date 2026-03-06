
CREATE TABLE public.password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_history_user_id ON public.password_history (user_id);

ALTER TABLE public.password_history ENABLE ROW LEVEL SECURITY;

-- No direct access from client - only edge functions with service role key
CREATE POLICY "No direct access" ON public.password_history
  FOR ALL USING (false);
