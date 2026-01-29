-- Add feature_events column to library_settings
ALTER TABLE public.library_settings 
ADD COLUMN IF NOT EXISTS feature_events boolean DEFAULT true;

-- Backfill existing rows to have events enabled
UPDATE public.library_settings SET feature_events = true WHERE feature_events IS NULL;