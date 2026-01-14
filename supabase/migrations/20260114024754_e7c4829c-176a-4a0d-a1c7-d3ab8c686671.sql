-- Insert theme customization settings
INSERT INTO public.site_settings (key, value) VALUES 
  ('theme_primary_h', '142'),
  ('theme_primary_s', '35'),
  ('theme_primary_l', '30'),
  ('theme_accent_h', '18'),
  ('theme_accent_s', '55'),
  ('theme_accent_l', '50'),
  ('theme_background_h', '39'),
  ('theme_background_s', '45'),
  ('theme_background_l', '94'),
  ('theme_font_display', 'MedievalSharp'),
  ('theme_font_body', 'IM Fell English'),
  ('turnstile_site_key', '0x4AAAAAACMX7o8e260x6gzV')
ON CONFLICT (key) DO NOTHING;