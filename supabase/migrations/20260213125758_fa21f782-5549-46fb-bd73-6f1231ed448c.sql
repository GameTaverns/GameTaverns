-- Add accent font column for the third typography slot
ALTER TABLE public.library_settings
ADD COLUMN IF NOT EXISTS theme_font_accent text DEFAULT NULL;