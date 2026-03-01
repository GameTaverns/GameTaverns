CREATE TABLE IF NOT EXISTS public.admin_email_allowlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    added_by UUID,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_email_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage allowlist"
ON public.admin_email_allowlist
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

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