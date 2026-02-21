
-- RPC to list all pg_cron jobs
CREATE OR REPLACE FUNCTION public.get_cron_jobs()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  command text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jobid, jobname, schedule, active, command
  FROM cron.job
  ORDER BY jobname;
$$;

-- RPC to get recent cron run details (last 200)
CREATE OR REPLACE FUNCTION public.get_cron_job_runs()
RETURNS TABLE (
  runid bigint,
  jobid bigint,
  job_pid integer,
  database text,
  username text,
  command text,
  status text,
  return_message text,
  start_time timestamptz,
  end_time timestamptz,
  jobname text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    d.runid, d.jobid, d.job_pid, d.database, d.username,
    d.command, d.status, d.return_message, d.start_time, d.end_time,
    j.jobname
  FROM cron.job_run_details d
  LEFT JOIN cron.job j ON j.jobid = d.jobid
  ORDER BY d.start_time DESC
  LIMIT 200;
$$;
