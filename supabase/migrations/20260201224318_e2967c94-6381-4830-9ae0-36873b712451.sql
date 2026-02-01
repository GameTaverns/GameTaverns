-- Create table to store TOTP 2FA settings per user
CREATE TABLE public.user_totp_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    totp_secret_encrypted TEXT NOT NULL,
    backup_codes_encrypted TEXT, -- JSON array of hashed backup codes
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_totp_settings ENABLE ROW LEVEL SECURITY;

-- Users can only view their own TOTP settings (but NOT the encrypted secret directly - that's handled by edge functions)
CREATE POLICY "Users can view their own TOTP status"
ON public.user_totp_settings
FOR SELECT
USING (auth.uid() = user_id);

-- Users cannot directly insert/update/delete - must go through edge functions
-- Service role handles all modifications

-- Create a helper function to check if user has completed 2FA setup
CREATE OR REPLACE FUNCTION public.user_has_totp_enabled(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_totp_settings
        WHERE user_id = _user_id AND is_enabled = true AND verified_at IS NOT NULL
    )
$$;

-- Create updated_at trigger
CREATE TRIGGER update_user_totp_settings_updated_at
BEFORE UPDATE ON public.user_totp_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();