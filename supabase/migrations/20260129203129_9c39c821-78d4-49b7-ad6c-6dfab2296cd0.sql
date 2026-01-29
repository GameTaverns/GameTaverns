-- Fix public view access for unauthenticated visitors
-- The app queries public.library_settings_public when signed out; it must not require direct privileges on public.library_settings.

BEGIN;

-- Ensure the public view runs with the view owner's privileges (not the caller's)
-- so anonymous users don't need direct access to the underlying table.
ALTER VIEW IF EXISTS public.library_settings_public
  SET (security_invoker = false);

-- Make sure anon/authenticated can read the public view
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.library_settings_public TO anon, authenticated;

COMMIT;