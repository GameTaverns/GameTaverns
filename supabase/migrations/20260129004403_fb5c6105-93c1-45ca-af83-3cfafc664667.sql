-- Add username column to user_profiles with unique constraint
ALTER TABLE public.user_profiles 
ADD COLUMN username TEXT UNIQUE;

-- Create index for faster username lookups
CREATE INDEX idx_user_profiles_username ON public.user_profiles(username);

-- Add constraint to ensure username follows valid format (alphanumeric, underscores, 3-30 chars)
ALTER TABLE public.user_profiles 
ADD CONSTRAINT username_format CHECK (
  username IS NULL OR (
    length(username) >= 3 AND 
    length(username) <= 30 AND 
    username ~ '^[a-zA-Z0-9_]+$'
  )
);