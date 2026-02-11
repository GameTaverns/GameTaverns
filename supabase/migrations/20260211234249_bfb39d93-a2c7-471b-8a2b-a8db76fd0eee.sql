-- Fix: Allow admins to cancel/update import jobs
CREATE POLICY "Admins can update import jobs"
ON public.import_jobs FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix: Allow admins to view ALL import jobs (not just their own library's)
CREATE POLICY "Admins can view all import jobs"
ON public.import_jobs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix: Allow admins to delete import jobs
CREATE POLICY "Admins can delete import jobs"
ON public.import_jobs FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));