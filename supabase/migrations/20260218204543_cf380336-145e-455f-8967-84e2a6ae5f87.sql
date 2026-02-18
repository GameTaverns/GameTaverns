-- Remove the incorrectly added Lovable Cloud cron job
SELECT cron.unschedule('catalog-format-descriptions-cron');