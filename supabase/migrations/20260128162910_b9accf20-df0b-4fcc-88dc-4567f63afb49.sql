-- Create import_jobs table to track bulk import progress
CREATE TABLE public.import_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  library_id uuid NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_items integer NOT NULL DEFAULT 0,
  processed_items integer NOT NULL DEFAULT 0,
  successful_items integer NOT NULL DEFAULT 0,
  failed_items integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

-- Library owners can view their import jobs
CREATE POLICY "Library owners can view their import jobs"
ON public.import_jobs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM libraries
    WHERE libraries.id = import_jobs.library_id
    AND libraries.owner_id = auth.uid()
  )
);

-- Library owners can create import jobs
CREATE POLICY "Library owners can create import jobs"
ON public.import_jobs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM libraries
    WHERE libraries.id = import_jobs.library_id
    AND libraries.owner_id = auth.uid()
  )
);

-- Service role can update import jobs (for edge function)
CREATE POLICY "Service role can update import jobs"
ON public.import_jobs
FOR UPDATE
USING (true);

-- Enable realtime for import_jobs
ALTER PUBLICATION supabase_realtime ADD TABLE public.import_jobs;

-- Add updated_at trigger
CREATE TRIGGER update_import_jobs_updated_at
BEFORE UPDATE ON public.import_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();