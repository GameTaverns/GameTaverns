-- Add featured_achievement_id column to user_profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_profiles' 
        AND column_name = 'featured_achievement_id'
    ) THEN
        ALTER TABLE public.user_profiles 
        ADD COLUMN featured_achievement_id uuid REFERENCES public.achievements(id) ON DELETE SET NULL;
    END IF;
END $$;