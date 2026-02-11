-- system_logs RLS policies: allow inserts from service role (edge function logger)
-- and reads for admin dashboard, deletes for purge feature
CREATE POLICY IF NOT EXISTS "Service role can insert logs"
ON public.system_logs FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Authenticated users can view logs"
ON public.system_logs FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Service role can delete logs"
ON public.system_logs FOR DELETE USING (true);
