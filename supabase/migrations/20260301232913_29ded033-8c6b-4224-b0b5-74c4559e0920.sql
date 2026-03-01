ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS admin_email TEXT UNIQUE;

-- Function to look up the real auth email from a @gametaverns.com admin alias
-- Returns the real email or NULL if no match
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