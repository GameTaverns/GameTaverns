-- Drop and recreate the view WITHOUT security_invoker to bypass RLS
DROP VIEW IF EXISTS public.site_settings_public;

CREATE VIEW public.site_settings_public AS
SELECT 
  id,
  key,
  value,
  created_at,
  updated_at
FROM public.site_settings
WHERE key NOT LIKE 'private_%';

-- Grant SELECT to all users (anon and authenticated)
GRANT SELECT ON public.site_settings_public TO anon, authenticated;