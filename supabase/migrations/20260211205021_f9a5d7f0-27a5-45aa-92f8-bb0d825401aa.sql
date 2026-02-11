-- Add missing columns to system_logs for the logger
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS library_id text;
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS user_id text;