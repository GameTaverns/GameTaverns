-- =============================================================================
-- Server Commands Queue (for webhook agent)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.server_commands (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    output text,
    requested_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz,
    completed_at timestamptz
);

ALTER TABLE public.server_commands ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "Admins can manage server commands"
ON public.server_commands FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_server_commands_status ON public.server_commands(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_server_commands_created ON public.server_commands(created_at);

NOTIFY pgrst, 'reload schema';
