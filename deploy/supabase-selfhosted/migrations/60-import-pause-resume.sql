-- =============================================================================
-- Import Pause/Resume Support
-- Version: 2.8.0
-- 
-- Adds import_metadata JSONB column to store enough info to resume interrupted
-- imports after system updates. Also updates the stuck-imports cron to skip
-- 'paused' jobs.
-- =============================================================================

-- Store import context for resumption: mode, bgg_username, items, options
ALTER TABLE public.import_jobs ADD COLUMN IF NOT EXISTS import_metadata JSONB;

-- Recreate the stuck-imports cron to explicitly skip 'paused' jobs
-- (paused jobs are managed by the update lifecycle, not the staleness check)
SELECT cron.unschedule('cleanup-stuck-imports')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-stuck-imports');

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
