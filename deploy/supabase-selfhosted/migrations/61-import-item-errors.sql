-- =============================================================================
-- Import Item Errors
-- Version: 2.9.0
--
-- Stores individual item-level failures from bulk imports so admins can
-- diagnose and retry specific games that failed.
-- =============================================================================

SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.import_item_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
    item_title TEXT,
    bgg_id TEXT,
    error_reason TEXT NOT NULL,
    error_category TEXT NOT NULL DEFAULT 'unknown',
    raw_input JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_item_errors_job_id ON public.import_item_errors(job_id);
CREATE INDEX IF NOT EXISTS idx_import_item_errors_created_at ON public.import_item_errors(created_at DESC);

-- RLS
ALTER TABLE public.import_item_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Library owners can view their import errors" ON public.import_item_errors;
CREATE POLICY "Library owners can view their import errors" ON public.import_item_errors
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.import_jobs ij
            JOIN public.libraries l ON l.id = ij.library_id
            WHERE ij.id = job_id AND l.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admins can view all import errors" ON public.import_item_errors;
CREATE POLICY "Admins can view all import errors" ON public.import_item_errors
    FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete import errors" ON public.import_item_errors;
CREATE POLICY "Admins can delete import errors" ON public.import_item_errors
    FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service role can insert import errors" ON public.import_item_errors;
CREATE POLICY "Service role can insert import errors" ON public.import_item_errors
    FOR INSERT WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
