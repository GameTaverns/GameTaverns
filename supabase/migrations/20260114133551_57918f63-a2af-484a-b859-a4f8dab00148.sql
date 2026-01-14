-- Add social media settings to site_settings
INSERT INTO public.site_settings (key, value) VALUES
  ('instagram_url', NULL),
  ('facebook_url', NULL),
  ('discord_url', NULL)
ON CONFLICT (key) DO NOTHING;