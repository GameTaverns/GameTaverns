-- Drop the global slug uniqueness constraint
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_slug_key;

-- Create a unique constraint scoped to library_id
CREATE UNIQUE INDEX games_slug_library_unique ON public.games (slug, library_id) WHERE library_id IS NOT NULL;

-- Keep global uniqueness for games without a library (legacy/orphaned)
CREATE UNIQUE INDEX games_slug_no_library_unique ON public.games (slug) WHERE library_id IS NULL;