-- Fix libraries_public view to use SECURITY INVOKER
DROP VIEW IF EXISTS public.libraries_public;

CREATE VIEW public.libraries_public 
WITH (security_invoker = true)
AS
SELECT 
    id,
    name,
    slug,
    description,
    custom_domain,
    is_active,
    is_premium,
    created_at,
    updated_at
FROM public.libraries
WHERE is_active = true;

-- Grant access to the public view
GRANT SELECT ON public.libraries_public TO anon, authenticated;