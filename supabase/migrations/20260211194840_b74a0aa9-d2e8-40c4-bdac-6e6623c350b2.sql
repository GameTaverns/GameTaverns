-- Add import_type column to track what kind of import (csv, bgg_collection, bgg_links)
ALTER TABLE public.import_jobs ADD COLUMN IF NOT EXISTS import_type text DEFAULT 'csv';

-- Backfill existing rows
UPDATE public.import_jobs SET import_type = 'csv' WHERE import_type IS NULL;