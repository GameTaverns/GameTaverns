-- Migration tracking table - uses 'gt_migrations' to avoid conflict
-- with Supabase's built-in 'schema_migrations' table (which uses version/bigint)
CREATE TABLE IF NOT EXISTS public.gt_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant access so the migration runner can query it
GRANT SELECT, INSERT ON public.gt_migrations TO postgres;
