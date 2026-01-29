-- Ensure public (signed-out) visitors can read library branding via public views
-- NOTE: We grant on views, not on base tables, to avoid exposing sensitive columns.

-- Schema usage (safe / required for view access)
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Public library + settings views used by TenantContext for signed-out visitors
GRANT SELECT ON public.libraries_public TO anon, authenticated;
GRANT SELECT ON public.library_settings_public TO anon, authenticated;

-- Some pages/widgets may use these public views as well
GRANT SELECT ON public.library_directory TO anon, authenticated;
GRANT SELECT ON public.library_calendar_events TO anon, authenticated;

-- Harden base table reads for anonymous users (they should use the public view)
REVOKE SELECT ON public.library_settings FROM anon;
