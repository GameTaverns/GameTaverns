
-- System audit log table for tracking operations across the platform
CREATE TABLE public.system_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    level text NOT NULL DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warn', 'error')),
    source text NOT NULL,          -- e.g. 'bulk-import', 'bgg-sync', 'image-proxy', 'auth'
    message text NOT NULL,
    metadata jsonb DEFAULT '{}',
    library_id uuid REFERENCES public.libraries(id) ON DELETE SET NULL,
    user_id uuid                   -- no FK to auth.users per guidelines
);

-- Index for efficient querying
CREATE INDEX idx_system_logs_created_at ON public.system_logs (created_at DESC);
CREATE INDEX idx_system_logs_source ON public.system_logs (source);
CREATE INDEX idx_system_logs_level ON public.system_logs (level);
CREATE INDEX idx_system_logs_library_id ON public.system_logs (library_id);

-- Enable RLS
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view logs
CREATE POLICY "Admins can view system logs"
ON public.system_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role inserts logs (edge functions use service_role key)
CREATE POLICY "Service role can insert logs"
ON public.system_logs FOR INSERT
WITH CHECK (true);

-- Admins can delete old logs
CREATE POLICY "Admins can delete system logs"
ON public.system_logs FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Auto-cleanup function for logs older than 30 days
CREATE OR REPLACE FUNCTION public.cleanup_old_system_logs(retention_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.system_logs
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
