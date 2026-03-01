-- Add marketing email opt-out column to user_profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS marketing_emails_opted_out boolean NOT NULL DEFAULT false;

-- Grant permissions for self-hosted visibility
GRANT ALL ON public.user_profiles TO authenticated, service_role, anon;

NOTIFY pgrst, 'reload schema';