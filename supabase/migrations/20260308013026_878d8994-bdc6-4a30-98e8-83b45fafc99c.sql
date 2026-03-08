
-- Feedback reply tokens: allow users to respond to staff replies via a tokenized link
CREATE TABLE IF NOT EXISTS public.feedback_reply_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID NOT NULL REFERENCES public.platform_feedback(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_reply_tokens_token ON public.feedback_reply_tokens(token);
CREATE INDEX IF NOT EXISTS idx_feedback_reply_tokens_feedback_id ON public.feedback_reply_tokens(feedback_id);

-- No RLS needed - this table is accessed only via edge functions with service role
ALTER TABLE public.feedback_reply_tokens ENABLE ROW LEVEL SECURITY;

-- Allow edge functions (service role) full access
GRANT ALL ON public.feedback_reply_tokens TO service_role;
GRANT SELECT ON public.feedback_reply_tokens TO anon;
