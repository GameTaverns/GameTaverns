-- =============================================================================
-- GameTaverns Self-Hosted: Game Copies & Inventory Tracking
-- Version: 2.4.0
-- =============================================================================

-- Add copies_owned to games table (quick reference count)
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS copies_owned INTEGER NOT NULL DEFAULT 1;

-- Create game_copies table for per-copy tracking
CREATE TABLE IF NOT EXISTS public.game_copies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    copy_number INTEGER NOT NULL DEFAULT 1,
    copy_label TEXT,
    condition TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(game_id, copy_number)
);

CREATE INDEX IF NOT EXISTS idx_game_copies_game ON public.game_copies(game_id);

-- Add optional copy_id to game_loans for per-copy tracking
ALTER TABLE public.game_loans ADD COLUMN IF NOT EXISTS copy_id UUID REFERENCES public.game_copies(id) ON DELETE SET NULL;

-- Enable RLS on game_copies
ALTER TABLE public.game_copies ENABLE ROW LEVEL SECURITY;

-- Anyone can view game copies (public library data)
CREATE POLICY "Anyone can view game copies"
ON public.game_copies
FOR SELECT
USING (true);

-- Library owners can manage copies
CREATE POLICY "Library owners can insert game copies"
ON public.game_copies
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.games g
        JOIN public.libraries l ON g.library_id = l.id
        WHERE g.id = game_id AND l.owner_id = auth.uid()
    )
);

CREATE POLICY "Library owners can update game copies"
ON public.game_copies
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.games g
        JOIN public.libraries l ON g.library_id = l.id
        WHERE g.id = game_id AND l.owner_id = auth.uid()
    )
);

CREATE POLICY "Library owners can delete game copies"
ON public.game_copies
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.games g
        JOIN public.libraries l ON g.library_id = l.id
        WHERE g.id = game_id AND l.owner_id = auth.uid()
    )
);

-- Add updated_at trigger for game_copies
CREATE TRIGGER update_game_copies_updated_at
BEFORE UPDATE ON public.game_copies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
