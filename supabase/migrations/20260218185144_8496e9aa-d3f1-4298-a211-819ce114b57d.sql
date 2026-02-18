
-- ===========================
-- 1. GAME HOTNESS VIEW
-- ===========================
CREATE OR REPLACE VIEW public.game_hotness AS
SELECT
  g.id AS game_id,
  g.title,
  g.image_url,
  g.slug,
  g.library_id,
  g.min_players,
  g.max_players,
  g.play_time,
  g.catalog_id,
  (COALESCE(p.play_score, 0) + COALESCE(w.wish_score, 0) + COALESCE(r.rating_score, 0))::INTEGER AS hotness_score,
  COALESCE(p.play_count, 0)::INTEGER AS recent_plays,
  COALESCE(w.wish_count, 0)::INTEGER AS recent_wishes,
  COALESCE(r.rating_count, 0)::INTEGER AS recent_ratings
FROM public.games g
LEFT JOIN (
  SELECT game_id,
    COUNT(*) * 10 AS play_score,
    COUNT(*) AS play_count
  FROM public.game_sessions
  WHERE played_at > NOW() - INTERVAL '30 days'
  GROUP BY game_id
) p ON p.game_id = g.id
LEFT JOIN (
  SELECT game_id,
    COUNT(*) * 4 AS wish_score,
    COUNT(*) AS wish_count
  FROM public.game_wishlist
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY game_id
) w ON w.game_id = g.id
LEFT JOIN (
  SELECT game_id,
    COUNT(*) * 2 AS rating_score,
    COUNT(*) AS rating_count
  FROM public.game_ratings
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY game_id
) r ON r.game_id = g.id
WHERE g.is_expansion = false
  AND g.is_coming_soon = false
  AND (COALESCE(p.play_score, 0) + COALESCE(w.wish_score, 0) + COALESCE(r.rating_score, 0)) > 0;

-- ===========================
-- 2. GAME DOCUMENTS TABLE
-- ===========================
CREATE TABLE IF NOT EXISTS public.game_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  catalog_id UUID REFERENCES public.game_catalog(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'rulebook',
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes INTEGER,
  language TEXT DEFAULT 'en',
  is_catalog_synced BOOLEAN NOT NULL DEFAULT false,
  sync_requested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.game_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Library members can view game documents"
  ON public.game_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.id = game_id
        AND (g.library_id IS NULL OR public.is_library_member(auth.uid(), g.library_id))
    )
  );

CREATE POLICY "Library owners can manage game documents"
  ON public.game_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.games g
      JOIN public.libraries l ON l.id = g.library_id
      WHERE g.id = game_id AND l.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.games g
      JOIN public.libraries l ON l.id = g.library_id
      WHERE g.id = game_id AND l.owner_id = auth.uid()
    )
  );

-- ===========================
-- 3. CURATED LISTS TABLES
-- ===========================
CREATE TABLE IF NOT EXISTS public.curated_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  library_id UUID REFERENCES public.libraries(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  vote_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.curated_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.curated_lists(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(list_id, game_id)
);

CREATE TABLE IF NOT EXISTS public.curated_list_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.curated_lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(list_id, user_id)
);

-- RLS for curated_lists
ALTER TABLE public.curated_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public lists are viewable by everyone"
  ON public.curated_lists FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Authenticated users can create lists"
  ON public.curated_lists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update their lists"
  ON public.curated_lists FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete their lists"
  ON public.curated_lists FOR DELETE
  USING (auth.uid() = user_id);

-- RLS for curated_list_items
ALTER TABLE public.curated_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Items on public lists are viewable"
  ON public.curated_list_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.curated_lists cl
      WHERE cl.id = list_id AND (cl.is_public = true OR cl.user_id = auth.uid())
    )
  );

CREATE POLICY "List owners can manage items"
  ON public.curated_list_items FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.curated_lists cl WHERE cl.id = list_id AND cl.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.curated_lists cl WHERE cl.id = list_id AND cl.user_id = auth.uid())
  );

-- RLS for curated_list_votes
ALTER TABLE public.curated_list_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Votes are publicly viewable"
  ON public.curated_list_votes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can vote"
  ON public.curated_list_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own votes"
  ON public.curated_list_votes FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to keep vote_count in sync
CREATE OR REPLACE FUNCTION public.update_curated_list_vote_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.curated_lists SET vote_count = vote_count + 1 WHERE id = NEW.list_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.curated_lists SET vote_count = GREATEST(0, vote_count - 1) WHERE id = OLD.list_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_curated_list_vote_count ON public.curated_list_votes;
CREATE TRIGGER trg_curated_list_vote_count
  AFTER INSERT OR DELETE ON public.curated_list_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_curated_list_vote_count();

-- ===========================
-- 4. PLAYER ELO RATINGS TABLE
-- ===========================
CREATE TABLE IF NOT EXISTS public.player_elo_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
  elo INTEGER NOT NULL DEFAULT 1000,
  games_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  peak_elo INTEGER NOT NULL DEFAULT 1000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, game_id)
);

ALTER TABLE public.player_elo_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ELO ratings are publicly viewable"
  ON public.player_elo_ratings FOR SELECT
  USING (true);

CREATE POLICY "System can manage ELO ratings"
  ON public.player_elo_ratings FOR ALL
  USING (true)
  WITH CHECK (true);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
