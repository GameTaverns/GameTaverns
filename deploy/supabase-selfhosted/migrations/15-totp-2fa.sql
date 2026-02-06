-- =============================================================================
-- GameTaverns Self-Hosted: Two-Factor Authentication (TOTP)
-- Version: 2.3.2 - Schema Parity Audit
-- =============================================================================

-- ===========================================
-- TOTP Settings Table
-- Stores encrypted TOTP secrets and backup codes
-- ===========================================
CREATE TABLE IF NOT EXISTS public.user_totp_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    totp_secret_encrypted TEXT NOT NULL,        -- Matches Cloud schema
    backup_codes_encrypted TEXT,                 -- Matches Cloud schema (TEXT, not TEXT[])
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    verified_at TIMESTAMPTZ,
    last_login_totp_verified_at TIMESTAMPTZ,     -- For 2FA grace period
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_totp_settings_user_id ON public.user_totp_settings(user_id);

-- Enable RLS
ALTER TABLE public.user_totp_settings ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- TOTP Helper Function
-- ===========================================
CREATE OR REPLACE FUNCTION public.user_has_totp_enabled(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_totp_settings
        WHERE user_id = _user_id AND is_enabled = true AND verified_at IS NOT NULL
    )
$$;

-- ===========================================
-- RLS Policies for TOTP Settings
-- ===========================================
DROP POLICY IF EXISTS "Users can view own TOTP settings" ON public.user_totp_settings;
CREATE POLICY "Users can view own TOTP settings" ON public.user_totp_settings
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own TOTP settings" ON public.user_totp_settings;
CREATE POLICY "Users can update own TOTP settings" ON public.user_totp_settings
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own TOTP settings" ON public.user_totp_settings;
CREATE POLICY "Users can insert own TOTP settings" ON public.user_totp_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own TOTP settings" ON public.user_totp_settings;
CREATE POLICY "Users can delete own TOTP settings" ON public.user_totp_settings
    FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all TOTP settings" ON public.user_totp_settings;
CREATE POLICY "Admins can manage all TOTP settings" ON public.user_totp_settings
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ===========================================
-- Updated_at Trigger
-- ===========================================
DROP TRIGGER IF EXISTS update_user_totp_settings_updated_at ON public.user_totp_settings;
CREATE TRIGGER update_user_totp_settings_updated_at
    BEFORE UPDATE ON public.user_totp_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
