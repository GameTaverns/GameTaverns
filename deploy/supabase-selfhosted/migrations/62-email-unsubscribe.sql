-- =============================================================================
-- Email Unsubscribe Support
-- Version: 2.10.0
--
-- Adds marketing_emails_opted_out to user_profiles for one-click unsubscribe.
-- =============================================================================

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS marketing_emails_opted_out boolean NOT NULL DEFAULT false;

GRANT ALL ON public.user_profiles TO authenticated, service_role, anon;

NOTIFY pgrst, 'reload schema';
