-- Add BGG sync configuration columns to library_settings
ALTER TABLE public.library_settings
  ADD COLUMN IF NOT EXISTS bgg_username text,
  ADD COLUMN IF NOT EXISTS bgg_sync_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bgg_sync_frequency text NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS bgg_sync_removal_behavior text NOT NULL DEFAULT 'flag',
  ADD COLUMN IF NOT EXISTS bgg_sync_collection boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bgg_sync_plays boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bgg_sync_wishlist boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bgg_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS bgg_last_sync_status text,
  ADD COLUMN IF NOT EXISTS bgg_last_sync_message text;
