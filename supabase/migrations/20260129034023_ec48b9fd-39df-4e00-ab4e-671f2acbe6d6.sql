-- Add discord_thread_id column to library_events to track created Discord threads
ALTER TABLE public.library_events 
ADD COLUMN IF NOT EXISTS discord_thread_id text;