-- =============================================================================
-- GameTaverns Self-Hosted: Designers & Artists Tables
-- =============================================================================

-- Designers (like publishers)
CREATE TABLE IF NOT EXISTS public.designers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.designers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "Designers are viewable by everyone" ON public.designers FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Admins can insert designers" ON public.designers FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Admins can update designers" ON public.designers FOR UPDATE USING (has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Admins can delete designers" ON public.designers FOR DELETE USING (has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Artists (like publishers)
CREATE TABLE IF NOT EXISTS public.artists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "Artists are viewable by everyone" ON public.artists FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Admins can insert artists" ON public.artists FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Admins can update artists" ON public.artists FOR UPDATE USING (has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Admins can delete artists" ON public.artists FOR DELETE USING (has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Catalog Designers junction
CREATE TABLE IF NOT EXISTS public.catalog_designers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_id uuid NOT NULL REFERENCES public.game_catalog(id) ON DELETE CASCADE,
    designer_id uuid NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
    UNIQUE(catalog_id, designer_id)
);
ALTER TABLE public.catalog_designers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "Anyone can view catalog designers" ON public.catalog_designers FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Admins can manage catalog designers" ON public.catalog_designers FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Catalog Artists junction
CREATE TABLE IF NOT EXISTS public.catalog_artists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_id uuid NOT NULL REFERENCES public.game_catalog(id) ON DELETE CASCADE,
    artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
    UNIQUE(catalog_id, artist_id)
);
ALTER TABLE public.catalog_artists ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "Anyone can view catalog artists" ON public.catalog_artists FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Admins can manage catalog artists" ON public.catalog_artists FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Game Designers junction
CREATE TABLE IF NOT EXISTS public.game_designers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    designer_id uuid NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
    UNIQUE(game_id, designer_id)
);
ALTER TABLE public.game_designers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "Game designers are viewable by everyone" ON public.game_designers FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Library owners can insert game_designers" ON public.game_designers FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM games g JOIN libraries l ON l.id = g.library_id WHERE g.id = game_designers.game_id AND l.owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Library owners can update game_designers" ON public.game_designers FOR UPDATE
    USING (EXISTS (SELECT 1 FROM games g JOIN libraries l ON l.id = g.library_id WHERE g.id = game_designers.game_id AND l.owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Library owners can delete game_designers" ON public.game_designers FOR DELETE
    USING (EXISTS (SELECT 1 FROM games g JOIN libraries l ON l.id = g.library_id WHERE g.id = game_designers.game_id AND l.owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Admins can insert game_designers" ON public.game_designers FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Admins can update game_designers" ON public.game_designers FOR UPDATE USING (has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Admins can delete game_designers" ON public.game_designers FOR DELETE USING (has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Game Artists junction
CREATE TABLE IF NOT EXISTS public.game_artists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
    UNIQUE(game_id, artist_id)
);
ALTER TABLE public.game_artists ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "Game artists are viewable by everyone" ON public.game_artists FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Library owners can insert game_artists" ON public.game_artists FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM games g JOIN libraries l ON l.id = g.library_id WHERE g.id = game_artists.game_id AND l.owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Library owners can update game_artists" ON public.game_artists FOR UPDATE
    USING (EXISTS (SELECT 1 FROM games g JOIN libraries l ON l.id = g.library_id WHERE g.id = game_artists.game_id AND l.owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Library owners can delete game_artists" ON public.game_artists FOR DELETE
    USING (EXISTS (SELECT 1 FROM games g JOIN libraries l ON l.id = g.library_id WHERE g.id = game_artists.game_id AND l.owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Admins can insert game_artists" ON public.game_artists FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Admins can update game_artists" ON public.game_artists FOR UPDATE USING (has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE POLICY "Admins can delete game_artists" ON public.game_artists FOR DELETE USING (has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_catalog_designers_catalog_id ON public.catalog_designers(catalog_id);
CREATE INDEX IF NOT EXISTS idx_catalog_designers_designer_id ON public.catalog_designers(designer_id);
CREATE INDEX IF NOT EXISTS idx_catalog_artists_catalog_id ON public.catalog_artists(catalog_id);
CREATE INDEX IF NOT EXISTS idx_catalog_artists_artist_id ON public.catalog_artists(artist_id);
CREATE INDEX IF NOT EXISTS idx_game_designers_game_id ON public.game_designers(game_id);
CREATE INDEX IF NOT EXISTS idx_game_designers_designer_id ON public.game_designers(designer_id);
CREATE INDEX IF NOT EXISTS idx_game_artists_game_id ON public.game_artists(game_id);
CREATE INDEX IF NOT EXISTS idx_game_artists_artist_id ON public.game_artists(artist_id);

NOTIFY pgrst, 'reload schema';
