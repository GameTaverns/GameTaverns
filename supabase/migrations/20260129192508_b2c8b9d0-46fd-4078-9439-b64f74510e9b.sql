-- Add new feature flags to library_settings
ALTER TABLE public.library_settings 
ADD COLUMN IF NOT EXISTS feature_achievements boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS feature_lending boolean DEFAULT true;

-- Update the public view to include new columns
DROP VIEW IF EXISTS public.library_settings_public;
CREATE VIEW public.library_settings_public WITH (security_invoker = true) AS
SELECT 
  id,
  library_id,
  logo_url,
  background_image_url,
  background_overlay_opacity,
  footer_text,
  contact_email,
  discord_url,
  facebook_url,
  instagram_url,
  twitter_handle,
  feature_play_logs,
  feature_wishlist,
  feature_for_sale,
  feature_messaging,
  feature_coming_soon,
  feature_ratings,
  feature_events,
  feature_achievements,
  feature_lending,
  theme_primary_h, theme_primary_s, theme_primary_l,
  theme_accent_h, theme_accent_s, theme_accent_l,
  theme_background_h, theme_background_s, theme_background_l,
  theme_card_h, theme_card_s, theme_card_l,
  theme_sidebar_h, theme_sidebar_s, theme_sidebar_l,
  theme_dark_primary_h, theme_dark_primary_s, theme_dark_primary_l,
  theme_dark_accent_h, theme_dark_accent_s, theme_dark_accent_l,
  theme_dark_background_h, theme_dark_background_s, theme_dark_background_l,
  theme_dark_card_h, theme_dark_card_s, theme_dark_card_l,
  theme_dark_sidebar_h, theme_dark_sidebar_s, theme_dark_sidebar_l,
  theme_font_display,
  theme_font_body,
  created_at,
  updated_at
FROM public.library_settings;