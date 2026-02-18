-- Add profile theme customization columns to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS profile_primary_h TEXT DEFAULT '25',
  ADD COLUMN IF NOT EXISTS profile_primary_s TEXT DEFAULT '35%',
  ADD COLUMN IF NOT EXISTS profile_primary_l TEXT DEFAULT '30%',
  ADD COLUMN IF NOT EXISTS profile_accent_h TEXT DEFAULT '35',
  ADD COLUMN IF NOT EXISTS profile_accent_s TEXT DEFAULT '45%',
  ADD COLUMN IF NOT EXISTS profile_accent_l TEXT DEFAULT '42%',
  ADD COLUMN IF NOT EXISTS profile_background_h TEXT DEFAULT '30',
  ADD COLUMN IF NOT EXISTS profile_background_s TEXT DEFAULT '20%',
  ADD COLUMN IF NOT EXISTS profile_background_l TEXT DEFAULT '95%',
  ADD COLUMN IF NOT EXISTS profile_bg_image_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS profile_bg_opacity TEXT DEFAULT '0.85';