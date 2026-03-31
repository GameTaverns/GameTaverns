-- Catalog gallery backfill cron job
-- DISABLED: All catalog crons paused for stabilization.

SELECT cron.unschedule('catalog-gallery-backfill-cron')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'catalog-gallery-backfill-cron');

-- SELECT cron.schedule(
--   'catalog-gallery-backfill-cron',
--   '* * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'http://kong:8000/functions/v1/catalog-gallery-backfill',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
--     ),
--     body := '{"limit": 100}'::jsonb
--   ) AS request_id;
--   $$
-- );
