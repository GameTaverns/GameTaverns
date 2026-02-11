-- Allow admins to cancel/update, view all, and delete import jobs
CREATE POLICY IF NOT EXISTS "Admins can update import jobs"
ON public.import_jobs FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY IF NOT EXISTS "Admins can view all import jobs"
ON public.import_jobs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY IF NOT EXISTS "Admins can delete import jobs"
ON public.import_jobs FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
