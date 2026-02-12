-- Auto-fail import jobs stuck in 'processing' for over 30 minutes
-- Runs every 5 minutes via pg_cron

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

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
