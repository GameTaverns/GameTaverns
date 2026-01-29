-- Add Discord webhook settings to library_settings
ALTER TABLE public.library_settings 
ADD COLUMN IF NOT EXISTS discord_webhook_url text,
ADD COLUMN IF NOT EXISTS discord_notifications jsonb DEFAULT '{"game_added": true, "wishlist_vote": true, "message_received": true, "poll_created": true, "poll_closed": true}'::jsonb;