-- Ensure turnstile_site_key is included in site_settings_public view.
-- It is a PUBLIC Cloudflare site key (safe to expose to anon) and is required
-- by the frontend TurnstileWidget to render the CAPTCHA challenge.
-- Previous migration versions incorrectly classified it as sensitive.

DROP VIEW IF EXISTS public.site_settings_public;

CREATE VIEW public.site_settings_public AS
SELECT key, value
FROM public.site_settings
WHERE key = ANY (ARRAY[
  'maintenance_mode',
  'maintenance_message',
  'announcement_enabled',
  'announcement_message',
  'announcement_type',
  'announcement_banner',
  'turnstile_site_key'
]);

GRANT SELECT ON public.site_settings_public TO anon, authenticated;