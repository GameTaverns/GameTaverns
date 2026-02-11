-- Add missing columns to system_logs that the logger expects
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS library_id text;
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS user_id text;
