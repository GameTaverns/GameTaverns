-- Add column to track last login TOTP verification for grace period
ALTER TABLE public.user_totp_settings 
ADD COLUMN IF NOT EXISTS last_login_totp_verified_at TIMESTAMPTZ;

-- Add column to configure grace period in minutes (default 120 = 2 hours)
-- This could be made per-user or global in site_settings later
COMMENT ON COLUMN public.user_totp_settings.last_login_totp_verified_at IS 'Timestamp of last successful TOTP verification at login. Used for grace period.';