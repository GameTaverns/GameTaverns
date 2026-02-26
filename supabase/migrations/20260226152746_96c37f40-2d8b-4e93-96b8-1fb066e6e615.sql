
-- Add ownership_status enum type
DO $$ BEGIN
    CREATE TYPE ownership_status AS ENUM ('owned', 'previously_owned', 'played_only');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add ownership_status column to games table with default 'owned'
ALTER TABLE public.games 
ADD COLUMN IF NOT EXISTS ownership_status ownership_status NOT NULL DEFAULT 'owned';

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_games_ownership_status ON public.games(library_id, ownership_status);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
