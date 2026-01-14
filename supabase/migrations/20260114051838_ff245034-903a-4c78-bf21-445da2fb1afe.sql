-- Add expansion fields to games table
ALTER TABLE public.games 
ADD COLUMN is_expansion boolean NOT NULL DEFAULT false,
ADD COLUMN parent_game_id uuid REFERENCES public.games(id) ON DELETE SET NULL;

-- Create index for faster parent lookups
CREATE INDEX idx_games_parent_game_id ON public.games(parent_game_id);

-- Add constraint: expansions must have a parent, non-expansions cannot have a parent
ALTER TABLE public.games 
ADD CONSTRAINT check_expansion_parent 
CHECK (
  (is_expansion = false AND parent_game_id IS NULL) OR 
  (is_expansion = true)
);