-- Add forum channel ID to library settings for Discord event posts
ALTER TABLE public.library_settings
ADD COLUMN IF NOT EXISTS discord_events_channel_id TEXT;