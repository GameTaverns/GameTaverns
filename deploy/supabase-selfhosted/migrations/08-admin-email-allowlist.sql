-- =============================================================================
-- GameTaverns Self-Hosted: Admin Email Alias + Allowlist
-- Version: 2.4.0
-- =============================================================================

-- Add admin_email alias column to user_profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS admin_email TEXT UNIQUE;

-- Function to look up the real auth email from a @gametaverns.com admin alias
CREATE OR REPLACE FUNCTION public.resolve_admin_email(_admin_email TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email
  FROM public.user_profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE lower(p.admin_email) = lower(_admin_email)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_admin_email(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_admin_email(TEXT) TO authenticated;

-- Optional: admin_email_allowlist table (can be used for additional gating)
CREATE TABLE IF NOT EXISTS public.admin_email_allowlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    added_by UUID,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_email_allowlist ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage allowlist' AND tablename = 'admin_email_allowlist'
  ) THEN
    CREATE POLICY "Admins can manage allowlist"
    ON public.admin_email_allowlist
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_admin_email_allowed(_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_email_allowlist
    WHERE lower(email) = lower(_email)
  )
$$;

GRANT ALL ON public.admin_email_allowlist TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_email_allowed(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_email_allowed(TEXT) TO anon;

NOTIFY pgrst, 'reload schema';
