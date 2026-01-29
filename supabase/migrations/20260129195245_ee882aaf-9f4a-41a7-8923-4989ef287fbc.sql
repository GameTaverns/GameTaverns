-- Allow anonymous users to read public-safe library settings via the view,
-- while preventing direct reads of the underlying private table.

-- 1) Ensure the view is selectable by anon/authenticated
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.library_settings_public TO anon, authenticated;

-- 2) Prevent anonymous users from selecting the private table directly
-- (owners still have access via RLS when authenticated)
REVOKE SELECT ON public.library_settings FROM anon;

-- Optional hardening: if any other roles had broad access, keep authenticated as-is.
-- (Do NOT revoke from authenticated; owners need to read/edit settings in-app.)
