-- Create email confirmation tokens table
CREATE TABLE public.email_confirmation_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  confirmed_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_confirmation_tokens ENABLE ROW LEVEL SECURITY;

-- Service role can manage tokens (used by edge functions)
CREATE POLICY "Service role can manage email confirmation tokens"
ON public.email_confirmation_tokens
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster token lookups
CREATE INDEX idx_email_confirmation_tokens_token ON public.email_confirmation_tokens(token);
CREATE INDEX idx_email_confirmation_tokens_email ON public.email_confirmation_tokens(email);

-- Add cleanup function for expired tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_email_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.email_confirmation_tokens
  WHERE expires_at < now() - interval '24 hours';
END;
$$;