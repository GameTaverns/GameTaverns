-- system_logs RLS policies: allow inserts from service role (edge function logger)
-- and reads for admin dashboard, deletes for purge feature
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_logs' AND policyname = 'Service role can insert logs') THEN
    CREATE POLICY "Service role can insert logs" ON public.system_logs FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_logs' AND policyname = 'Authenticated users can view logs') THEN
    CREATE POLICY "Authenticated users can view logs" ON public.system_logs FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_logs' AND policyname = 'Service role can delete logs') THEN
    CREATE POLICY "Service role can delete logs" ON public.system_logs FOR DELETE USING (true);
  END IF;
END $$;
