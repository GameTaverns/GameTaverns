-- Add featured achievement badge column to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS featured_achievement_id uuid REFERENCES public.achievements(id) ON DELETE SET NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.user_profiles.featured_achievement_id IS 'The achievement badge the user has chosen to display next to their name';