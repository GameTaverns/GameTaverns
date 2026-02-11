-- Add import_type column to import_jobs
ALTER TABLE public.import_jobs ADD COLUMN IF NOT EXISTS import_type text DEFAULT 'csv';
UPDATE public.import_jobs SET import_type = 'csv' WHERE import_type IS NULL;
