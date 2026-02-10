
DROP VIEW IF EXISTS public.site_settings_public;

CREATE VIEW public.site_settings_public AS
SELECT key, value
FROM site_settings
WHERE key = ANY (ARRAY[
  'maintenance_mode',
  'maintenance_message',
  'announcement_enabled',
  'announcement_message',
  'announcement_type',
  'announcement_banner',
  'turnstile_site_key'
]);

ALTER VIEW public.site_settings_public SET (security_invoker = false);
