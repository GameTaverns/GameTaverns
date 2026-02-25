CREATE TABLE IF NOT EXISTS public.import_item_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  item_title TEXT,
  bgg_id TEXT,
  error_message TEXT NOT NULL,
  error_type TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for looking up errors by job
CREATE INDEX IF NOT EXISTS idx_import_item_errors_job_id ON public.import_item_errors(job_id);

-- RLS: library owners/admins can view errors for their import jobs
ALTER TABLE public.import_item_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view errors for their library import jobs"
  ON public.import_item_errors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.import_jobs ij
      JOIN public.libraries l ON l.id = ij.library_id
      LEFT JOIN public.library_members lm ON lm.library_id = l.id AND lm.user_id = auth.uid()
      WHERE ij.id = import_item_errors.job_id
        AND (l.owner_id = auth.uid() OR lm.user_id IS NOT NULL)
    )
  );