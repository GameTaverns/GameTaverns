-- Add encrypted columns to game_messages table
-- Keep original columns for now to avoid breaking existing functionality
-- We'll store encrypted data in new columns

ALTER TABLE public.game_messages 
ADD COLUMN IF NOT EXISTS sender_name_encrypted text,
ADD COLUMN IF NOT EXISTS sender_email_encrypted text,
ADD COLUMN IF NOT EXISTS sender_ip_encrypted text;

-- Add comment explaining the encryption
COMMENT ON COLUMN public.game_messages.sender_name_encrypted IS 'AES-256-GCM encrypted sender name';
COMMENT ON COLUMN public.game_messages.sender_email_encrypted IS 'AES-256-GCM encrypted sender email';
COMMENT ON COLUMN public.game_messages.sender_ip_encrypted IS 'AES-256-GCM encrypted sender IP for rate limiting';