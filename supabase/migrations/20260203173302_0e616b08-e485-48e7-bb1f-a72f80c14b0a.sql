-- Change default for allow_lending to true
ALTER TABLE public.library_settings 
ALTER COLUMN allow_lending SET DEFAULT true;

-- Update existing libraries: sync allow_lending with feature_lending
-- Libraries with lending feature enabled should be discoverable as lending libraries
UPDATE public.library_settings
SET allow_lending = COALESCE(feature_lending, true)
WHERE allow_lending = false;