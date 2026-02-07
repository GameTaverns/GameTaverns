-- Add featured achievement support to user_profiles (self-hosted parity)
-- This is required for profile-update to work without PostgREST schema cache errors.

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS featured_achievement_id uuid NULL;

-- Optional FK (safe): achievements exist in this schema.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_profiles_featured_achievement_id_fkey'
  ) THEN
    ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_featured_achievement_id_fkey
    FOREIGN KEY (featured_achievement_id)
    REFERENCES public.achievements(id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_profiles_featured_achievement_id
ON public.user_profiles(featured_achievement_id);
