-- system_logs RLS policies: allow inserts from service role (edge function logger)
-- and reads for admin dashboard, deletes for purge feature
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_logs' AND policyname = 'Service role can insert logs') THEN
    CREATE POLICY "Service role can insert logs" ON public.system_logs FOR INSERT TO service_role WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_logs' AND policyname = 'Admins can view logs') THEN
    CREATE POLICY "Admins can view logs" ON public.system_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_logs' AND policyname = 'Service role can delete logs') THEN
    CREATE POLICY "Service role can delete logs" ON public.system_logs FOR DELETE TO service_role USING (true);
  END IF;
END $$;
