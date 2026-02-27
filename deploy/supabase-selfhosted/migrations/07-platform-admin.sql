-- =============================================================================
-- GameTaverns Self-Hosted: Platform Admin & Misc Tables
-- Version: 2.3.2 - Schema Parity Audit
-- =============================================================================

-- ===========================================
-- Platform Feedback
-- ===========================================
CREATE TABLE IF NOT EXISTS public.platform_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type feedback_type NOT NULL,
    sender_name TEXT NOT NULL,
    sender_email TEXT,
    message TEXT NOT NULL,
    screenshot_urls TEXT[] NOT NULL DEFAULT '{}',
    is_read BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'open',
    assigned_to UUID,
    assigned_to_name TEXT,
    discord_thread_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backward-compatible parity upgrades for existing self-hosted installs
ALTER TABLE public.platform_feedback ADD COLUMN IF NOT EXISTS screenshot_urls TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.platform_feedback ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE public.platform_feedback ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE public.platform_feedback ADD COLUMN IF NOT EXISTS assigned_to_name TEXT;
ALTER TABLE public.platform_feedback ADD COLUMN IF NOT EXISTS discord_thread_id TEXT;
ALTER TABLE public.platform_feedback ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ===========================================
-- Feedback Notes (staff activity/replies)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.feedback_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID NOT NULL REFERENCES public.platform_feedback(id) ON DELETE CASCADE,
    author_id UUID NOT NULL,
    author_name TEXT,
    content TEXT NOT NULL,
    note_type TEXT NOT NULL DEFAULT 'internal',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_notes_feedback_id ON public.feedback_notes(feedback_id);

-- ===========================================
-- Site Settings (global platform settings)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.site_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO public.site_settings (key, value) VALUES
    ('maintenance_mode', 'false'),
    ('maintenance_message', 'We are currently performing scheduled maintenance. Please check back soon.'),
    ('announcement_enabled', 'false'),
    ('announcement_message', ''),
    ('announcement_type', 'info'),
    ('turnstile_site_key', ''),
    ('allow_new_signups', 'true'),
    ('max_libraries_per_user', '1')
ON CONFLICT (key) DO NOTHING;

-- ===========================================
-- Library Suspensions (audit log)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.library_suspensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
    action suspension_action NOT NULL,
    reason TEXT,
    performed_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- Import Jobs (bulk import tracking)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_items INTEGER NOT NULL DEFAULT 0,
    successful_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- Auth Tokens (password reset, email confirm)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens(token);

CREATE TABLE IF NOT EXISTS public.email_confirmation_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_confirmation_tokens_token ON public.email_confirmation_tokens(token);
