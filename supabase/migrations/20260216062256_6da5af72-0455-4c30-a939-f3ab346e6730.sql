-- Add import_metadata JSONB column to store enough info to resume interrupted imports
-- Stores: mode, bgg_username, items list (for CSV/links), default_options, enhance flags
ALTER TABLE public.import_jobs ADD COLUMN IF NOT EXISTS import_metadata JSONB;

-- Update the stuck-imports cron job to skip 'paused' jobs
-- First unschedule the old job, then recreate with updated WHERE clause
SELECT cron.unschedule('cleanup-stuck-imports') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-stuck-imports'
);

SELECT cron.schedule(
  'cleanup-stuck-imports',
  '*/5 * * * *',
  $$
  UPDATE public.import_jobs
  SET status = 'failed',
      error_message = 'Auto-cancelled: job stalled for over 30 minutes'
  WHERE status = 'processing'
    AND updated_at < now() - interval '30 minutes';
  $$
);