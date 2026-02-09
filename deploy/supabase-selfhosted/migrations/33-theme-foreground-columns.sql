-- Add foreground/text color columns to library_settings
ALTER TABLE public.library_settings
  ADD COLUMN IF NOT EXISTS theme_foreground_h text,
  ADD COLUMN IF NOT EXISTS theme_foreground_s text,
  ADD COLUMN IF NOT EXISTS theme_foreground_l text,
  ADD COLUMN IF NOT EXISTS theme_dark_foreground_h text,
  ADD COLUMN IF NOT EXISTS theme_dark_foreground_s text,
  ADD COLUMN IF NOT EXISTS theme_dark_foreground_l text;
