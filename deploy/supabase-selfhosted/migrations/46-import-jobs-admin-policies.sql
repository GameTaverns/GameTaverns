-- Allow admins to cancel/update, view all, and delete import jobs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'import_jobs' AND policyname = 'Admins can update import jobs') THEN
    CREATE POLICY "Admins can update import jobs" ON public.import_jobs FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'import_jobs' AND policyname = 'Admins can view all import jobs') THEN
    CREATE POLICY "Admins can view all import jobs" ON public.import_jobs FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'import_jobs' AND policyname = 'Admins can delete import jobs') THEN
    CREATE POLICY "Admins can delete import jobs" ON public.import_jobs FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;
