-- Add encrypted message column
ALTER TABLE public.game_messages 
ADD COLUMN IF NOT EXISTS message_encrypted TEXT;