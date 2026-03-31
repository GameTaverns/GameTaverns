-- Catalog backfill cron jobs (comprehensive)
-- DISABLED: All catalog crons paused for stabilization.
-- Only unschedule blocks remain active to clean up any lingering jobs.

SELECT cron.unschedule('catalog-type-check-cron')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'catalog-type-check-cron');

SELECT cron.unschedule('catalog-enrichment-cron')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'catalog-enrichment-cron');

SELECT cron.unschedule('catalog-re-enrich-cron')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'catalog-re-enrich-cron');

SELECT cron.unschedule('catalog-dedup-cron')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'catalog-dedup-cron');

SELECT cron.unschedule('catalog-cleanup-non-boardgames')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'catalog-cleanup-non-boardgames');
