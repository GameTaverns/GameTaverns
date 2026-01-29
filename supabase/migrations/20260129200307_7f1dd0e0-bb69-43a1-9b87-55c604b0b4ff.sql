-- Ensure anon/authenticated can read public-facing views used by tenant public pages
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Public library metadata
GRANT SELECT ON public.libraries_public TO anon, authenticated;

-- Public, non-sensitive library settings used for theming/branding
GRANT SELECT ON public.library_settings_public TO anon, authenticated;

-- (Optional safety) prevent anon from reading the sensitive base table directly
REVOKE SELECT ON public.library_settings FROM anon;