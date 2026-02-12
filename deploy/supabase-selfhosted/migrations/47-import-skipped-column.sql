-- Add skipped_items column to import_jobs for tracking "already exists" games separately from failures
ALTER TABLE public.import_jobs ADD COLUMN IF NOT EXISTS skipped_items integer NOT NULL DEFAULT 0;
