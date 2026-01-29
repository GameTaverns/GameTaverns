-- Add Discord user ID to user_profiles for DM notifications
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS discord_user_id text;

-- Add index for looking up users by Discord ID
CREATE INDEX IF NOT EXISTS idx_user_profiles_discord_user_id 
ON public.user_profiles(discord_user_id) 
WHERE discord_user_id IS NOT NULL;