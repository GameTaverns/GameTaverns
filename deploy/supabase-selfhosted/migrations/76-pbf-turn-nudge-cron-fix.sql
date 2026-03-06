-- Fix pbf-turn-nudge cron: use jsonb_build_object instead of string concat
-- Prevents "invalid input syntax for type json" errors

SELECT cron.unschedule('pbf-turn-nudge-cron')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pbf-turn-nudge-cron');

SELECT cron.schedule(
  'pbf-turn-nudge-cron',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'http://kong:8000/functions/v1/pbf-turn-nudge',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
