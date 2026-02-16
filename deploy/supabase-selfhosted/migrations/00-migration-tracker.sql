-- Migration tracking table - runs first, creates the tracker if it doesn't exist
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant access so the migration runner can query it
GRANT SELECT, INSERT ON public.schema_migrations TO postgres;
