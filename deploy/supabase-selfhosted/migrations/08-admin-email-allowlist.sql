-- =============================================================================
-- GameTaverns Self-Hosted: Admin Email Allowlist
-- Version: 2.4.0
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.admin_email_allowlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    added_by UUID,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_email_allowlist ENABLE ROW LEVEL SECURITY;

-- RLS: only admins can read/write
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

-- Security definer function to check allowlist (callable by anon too for login gate)
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
GRANT SELECT ON public.admin_email_allowlist TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_email_allowed(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_email_allowed(TEXT) TO anon;

NOTIFY pgrst, 'reload schema';
