-- =====================
-- Canonical Game Catalog
-- =====================

-- Core catalog: one row per unique game in the world
CREATE TABLE IF NOT EXISTS public.game_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bgg_id TEXT UNIQUE,
    title TEXT NOT NULL,
    slug TEXT,
    description TEXT,
    image_url TEXT,
    additional_images TEXT[] DEFAULT '{}',
    min_players INTEGER,
    max_players INTEGER,
    play_time_minutes INTEGER,
    weight NUMERIC(3,2),
    year_published INTEGER,
    suggested_age TEXT,
    is_expansion BOOLEAN NOT NULL DEFAULT false,
    parent_catalog_id UUID REFERENCES public.game_catalog(id),
    bgg_url TEXT,
    bgg_community_rating NUMERIC(4,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_catalog_bgg_id ON public.game_catalog(bgg_id);
CREATE INDEX IF NOT EXISTS idx_game_catalog_slug ON public.game_catalog(slug);
CREATE INDEX IF NOT EXISTS idx_game_catalog_title ON public.game_catalog USING gin(to_tsvector('english', title));

-- Catalog mechanics (many-to-many with existing mechanics table)
CREATE TABLE IF NOT EXISTS public.catalog_mechanics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_id UUID NOT NULL REFERENCES public.game_catalog(id) ON DELETE CASCADE,
    mechanic_id UUID NOT NULL REFERENCES public.mechanics(id) ON DELETE CASCADE,
    UNIQUE(catalog_id, mechanic_id)
);

-- Catalog publishers (many-to-many with existing publishers table)
CREATE TABLE IF NOT EXISTS public.catalog_publishers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_id UUID NOT NULL REFERENCES public.game_catalog(id) ON DELETE CASCADE,
    publisher_id UUID NOT NULL REFERENCES public.publishers(id) ON DELETE CASCADE,
    UNIQUE(catalog_id, publisher_id)
);

-- Community-curated how-to-play videos
CREATE TABLE IF NOT EXISTS public.catalog_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_id UUID NOT NULL REFERENCES public.game_catalog(id) ON DELETE CASCADE,
    youtube_url TEXT NOT NULL,
    title TEXT,
    source TEXT DEFAULT 'auto',
    upvotes INTEGER NOT NULL DEFAULT 0,
    downvotes INTEGER NOT NULL DEFAULT 0,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    submitted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_videos_catalog ON public.catalog_videos(catalog_id);

-- Video votes (one vote per user per video)
CREATE TABLE IF NOT EXISTS public.catalog_video_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES public.catalog_videos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(video_id, user_id)
);

-- Community corrections / suggestions
CREATE TABLE IF NOT EXISTS public.catalog_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_id UUID NOT NULL REFERENCES public.game_catalog(id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES auth.users(id),
    field_name TEXT NOT NULL,
    suggested_value TEXT NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_corrections_status ON public.catalog_corrections(status);

-- Link existing games to catalog entries
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS catalog_id UUID REFERENCES public.game_catalog(id);
CREATE INDEX IF NOT EXISTS idx_games_catalog_id ON public.games(catalog_id);

-- Triggers
DO $$ BEGIN
    CREATE TRIGGER game_catalog_updated_at
        BEFORE UPDATE ON public.game_catalog
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER catalog_videos_updated_at
        BEFORE UPDATE ON public.catalog_videos
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Auto-generate slug for catalog entries
CREATE OR REPLACE FUNCTION public.set_catalog_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
        NEW.slug := public.slugify(NEW.title);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path TO 'public';

DO $$ BEGIN
    CREATE TRIGGER game_catalog_set_slug
        BEFORE INSERT OR UPDATE ON public.game_catalog
        FOR EACH ROW EXECUTE FUNCTION public.set_catalog_slug();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================
-- RLS Policies
-- =====================

ALTER TABLE public.game_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_mechanics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_video_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_corrections ENABLE ROW LEVEL SECURITY;

-- game_catalog: public read, admin/service write
DO $$ BEGIN
    CREATE POLICY "Anyone can view catalog" ON public.game_catalog FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Admins can manage catalog" ON public.game_catalog FOR ALL
        USING (has_role(auth.uid(), 'admin'::app_role))
        WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- catalog_mechanics: public read
DO $$ BEGIN
    CREATE POLICY "Anyone can view catalog mechanics" ON public.catalog_mechanics FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Admins can manage catalog mechanics" ON public.catalog_mechanics FOR ALL
        USING (has_role(auth.uid(), 'admin'::app_role))
        WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- catalog_publishers: public read
DO $$ BEGIN
    CREATE POLICY "Anyone can view catalog publishers" ON public.catalog_publishers FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Admins can manage catalog publishers" ON public.catalog_publishers FOR ALL
        USING (has_role(auth.uid(), 'admin'::app_role))
        WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- catalog_videos: public read, auth insert, admin manage
DO $$ BEGIN
    CREATE POLICY "Anyone can view catalog videos" ON public.catalog_videos FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Authenticated users can submit videos" ON public.catalog_videos FOR INSERT
        WITH CHECK (auth.uid() = submitted_by);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Admins can manage catalog videos" ON public.catalog_videos FOR ALL
        USING (has_role(auth.uid(), 'admin'::app_role))
        WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- catalog_video_votes
DO $$ BEGIN
    CREATE POLICY "Users can view their own votes" ON public.catalog_video_votes FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can vote on videos" ON public.catalog_video_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can change their vote" ON public.catalog_video_votes FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can remove their vote" ON public.catalog_video_votes FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- catalog_corrections
DO $$ BEGIN
    CREATE POLICY "Users can view their own corrections" ON public.catalog_corrections FOR SELECT USING (auth.uid() = submitted_by);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can submit corrections" ON public.catalog_corrections FOR INSERT WITH CHECK (auth.uid() = submitted_by);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Admins can manage corrections" ON public.catalog_corrections FOR ALL
        USING (has_role(auth.uid(), 'admin'::app_role))
        WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- View: catalog with ownership count
CREATE OR REPLACE VIEW public.catalog_popularity WITH (security_invoker = true) AS
SELECT
    gc.id AS catalog_id,
    gc.title,
    gc.slug,
    gc.bgg_id,
    gc.image_url,
    gc.weight,
    gc.min_players,
    gc.max_players,
    gc.play_time_minutes,
    COUNT(DISTINCT g.library_id) FILTER (WHERE g.ownership_status = 'owned') AS library_count,
    COUNT(DISTINCT gs.id) AS total_plays
FROM public.game_catalog gc
LEFT JOIN public.games g ON g.catalog_id = gc.id
LEFT JOIN public.game_sessions gs ON gs.game_id = g.id
GROUP BY gc.id, gc.title, gc.slug, gc.bgg_id, gc.image_url, gc.weight, gc.min_players, gc.max_players, gc.play_time_minutes;

GRANT SELECT ON public.catalog_popularity TO anon, authenticated;
