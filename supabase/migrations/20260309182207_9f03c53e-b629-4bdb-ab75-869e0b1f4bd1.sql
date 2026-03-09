
-- =============================================================================
-- News Platform + Game Reviews Schema
-- =============================================================================

-- ── News Sources (RSS feeds, scrape targets) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.news_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  source_type text NOT NULL DEFAULT 'rss' CHECK (source_type IN ('rss', 'scrape', 'manual')),
  feed_url text,
  website_url text,
  logo_url text,
  is_trusted boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT true,
  fetch_interval_minutes integer NOT NULL DEFAULT 30,
  last_fetched_at timestamptz,
  last_error text,
  scrape_config jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── News Categories ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.news_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  icon text,
  color text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed default categories
INSERT INTO public.news_categories (name, slug, icon, color, display_order) VALUES
  ('Crowdfunding', 'crowdfunding', 'Rocket', 'emerald', 1),
  ('New Releases', 'new-releases', 'Sparkles', 'blue', 2),
  ('Reviews', 'reviews', 'Star', 'amber', 3),
  ('Events', 'events', 'Calendar', 'rose', 4),
  ('Industry News', 'industry-news', 'Newspaper', 'slate', 5),
  ('Previews', 'previews', 'Eye', 'violet', 6),
  ('Rumors & Leaks', 'rumors', 'MessageCircle', 'orange', 7),
  ('Deals & Sales', 'deals', 'Tag', 'green', 8)
ON CONFLICT (slug) DO NOTHING;

-- ── News Articles ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.news_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.news_sources(id) ON DELETE SET NULL,
  submitted_by uuid,
  title text NOT NULL,
  slug text NOT NULL,
  summary text,
  content text,
  content_format text NOT NULL DEFAULT 'markdown' CHECK (content_format IN ('markdown', 'html')),
  source_url text,
  image_url text,
  author_name text,
  published_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected', 'archived')),
  moderated_by uuid,
  moderated_at timestamptz,
  rejection_reason text,
  ai_summary text,
  ai_categories jsonb,
  upvotes integer NOT NULL DEFAULT 0,
  downvotes integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  comment_thread_id uuid,
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_news_articles_status ON public.news_articles(status);
CREATE INDEX IF NOT EXISTS idx_news_articles_published_at ON public.news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_slug ON public.news_articles(slug);

-- ── News Article <-> Category junction ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.news_article_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.news_categories(id) ON DELETE CASCADE,
  UNIQUE (article_id, category_id)
);

-- ── News Article Reactions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.news_article_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reaction_type text NOT NULL DEFAULT 'upvote' CHECK (reaction_type IN ('upvote', 'downvote')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (article_id, user_id)
);

-- ── News Bookmarks ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.news_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (article_id, user_id)
);

-- ── News Article <-> Catalog Game links ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.news_article_catalog_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  catalog_id uuid NOT NULL REFERENCES public.game_catalog(id) ON DELETE CASCADE,
  relevance_score numeric(3,2) DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (article_id, catalog_id)
);

-- ── Game Reviews ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.game_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  catalog_id uuid NOT NULL REFERENCES public.game_catalog(id) ON DELETE CASCADE,
  game_id uuid REFERENCES public.games(id) ON DELETE SET NULL,
  rating_overall numeric(3,1) NOT NULL CHECK (rating_overall >= 1 AND rating_overall <= 10),
  rating_gameplay numeric(3,1) CHECK (rating_gameplay >= 1 AND rating_gameplay <= 10),
  rating_components numeric(3,1) CHECK (rating_components >= 1 AND rating_components <= 10),
  rating_replayability numeric(3,1) CHECK (rating_replayability >= 1 AND rating_replayability <= 10),
  rating_value numeric(3,1) CHECK (rating_value >= 1 AND rating_value <= 10),
  title text,
  content text NOT NULL CHECK (char_length(content) >= 100),
  recommended boolean,
  play_count_at_review integer,
  ownership_status text NOT NULL CHECK (ownership_status IN ('owned', 'previously_owned')),
  reviewer_weight numeric(5,2) NOT NULL DEFAULT 1.0,
  helpful_count integer NOT NULL DEFAULT 0,
  unhelpful_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'flagged', 'removed')),
  flagged_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, catalog_id)
);

CREATE INDEX IF NOT EXISTS idx_game_reviews_catalog ON public.game_reviews(catalog_id);
CREATE INDEX IF NOT EXISTS idx_game_reviews_user ON public.game_reviews(user_id);

-- ── Review Helpfulness Votes ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.game_review_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.game_reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  vote_type text NOT NULL CHECK (vote_type IN ('helpful', 'unhelpful')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, user_id)
);

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE public.news_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_article_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_article_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_article_catalog_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_review_votes ENABLE ROW LEVEL SECURITY;

-- News Sources: public read, admin write
CREATE POLICY "Anyone can view enabled news sources" ON public.news_sources
  FOR SELECT USING (is_enabled = true);
CREATE POLICY "Admins manage news sources" ON public.news_sources
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- News Categories: public read
CREATE POLICY "Anyone can view news categories" ON public.news_categories
  FOR SELECT USING (true);
CREATE POLICY "Admins manage news categories" ON public.news_categories
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- News Articles: published are public, pending visible to admins/submitter
CREATE POLICY "Anyone can view published articles" ON public.news_articles
  FOR SELECT USING (status = 'published');
CREATE POLICY "Submitters can view own pending" ON public.news_articles
  FOR SELECT TO authenticated USING (submitted_by = auth.uid());
CREATE POLICY "Staff can view all articles" ON public.news_articles
  FOR SELECT TO authenticated USING (public.has_role_level(auth.uid(), 'staff'));
CREATE POLICY "Authenticated users can submit articles" ON public.news_articles
  FOR INSERT TO authenticated WITH CHECK (submitted_by = auth.uid() AND status = 'pending');
CREATE POLICY "Admins manage all articles" ON public.news_articles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Article Categories: public read, admin write
CREATE POLICY "Anyone can view article categories" ON public.news_article_categories
  FOR SELECT USING (true);
CREATE POLICY "Admins manage article categories" ON public.news_article_categories
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Reactions: authenticated users
CREATE POLICY "Anyone can view reactions" ON public.news_article_reactions
  FOR SELECT USING (true);
CREATE POLICY "Users manage own reactions" ON public.news_article_reactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own reactions" ON public.news_article_reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Bookmarks: own only
CREATE POLICY "Users view own bookmarks" ON public.news_bookmarks
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users manage own bookmarks" ON public.news_bookmarks
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own bookmarks" ON public.news_bookmarks
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Catalog links: public read
CREATE POLICY "Anyone can view catalog links" ON public.news_article_catalog_links
  FOR SELECT USING (true);
CREATE POLICY "Admins manage catalog links" ON public.news_article_catalog_links
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Game Reviews: public read, ownership-gated write
CREATE POLICY "Anyone can view published reviews" ON public.game_reviews
  FOR SELECT USING (status = 'published');
CREATE POLICY "Users can insert own review" ON public.game_reviews
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own review" ON public.game_reviews
  FOR UPDATE TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage all reviews" ON public.game_reviews
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Review Votes
CREATE POLICY "Anyone can view review votes" ON public.game_review_votes
  FOR SELECT USING (true);
CREATE POLICY "Users manage own votes" ON public.game_review_votes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own votes" ON public.game_review_votes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================================================
-- Functions & Triggers
-- =============================================================================

-- Update vote counts on news articles
CREATE OR REPLACE FUNCTION public.update_news_article_votes()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.reaction_type = 'upvote' THEN
      UPDATE news_articles SET upvotes = upvotes + 1 WHERE id = NEW.article_id;
    ELSE
      UPDATE news_articles SET downvotes = downvotes + 1 WHERE id = NEW.article_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.reaction_type = 'upvote' THEN
      UPDATE news_articles SET upvotes = GREATEST(0, upvotes - 1) WHERE id = OLD.article_id;
    ELSE
      UPDATE news_articles SET downvotes = GREATEST(0, downvotes - 1) WHERE id = OLD.article_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_news_article_votes
AFTER INSERT OR DELETE ON public.news_article_reactions
FOR EACH ROW EXECUTE FUNCTION public.update_news_article_votes();

-- Update helpfulness counts on reviews
CREATE OR REPLACE FUNCTION public.update_review_helpfulness()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote_type = 'helpful' THEN
      UPDATE game_reviews SET helpful_count = helpful_count + 1 WHERE id = NEW.review_id;
    ELSE
      UPDATE game_reviews SET unhelpful_count = unhelpful_count + 1 WHERE id = NEW.review_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote_type = 'helpful' THEN
      UPDATE game_reviews SET helpful_count = GREATEST(0, helpful_count - 1) WHERE id = OLD.review_id;
    ELSE
      UPDATE game_reviews SET unhelpful_count = GREATEST(0, unhelpful_count - 1) WHERE id = OLD.review_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_review_helpfulness
AFTER INSERT OR DELETE ON public.game_review_votes
FOR EACH ROW EXECUTE FUNCTION public.update_review_helpfulness();

-- Calculate reviewer weight based on reputation
CREATE OR REPLACE FUNCTION public.calculate_reviewer_weight(_user_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT LEAST(3.0, GREATEST(0.5,
    1.0
    + LEAST(0.5, (SELECT COUNT(*)::numeric * 0.01 FROM games g JOIN libraries l ON l.id = g.library_id WHERE l.owner_id = _user_id AND g.ownership_status = 'owned'))
    + LEAST(0.5, (SELECT COUNT(*)::numeric * 0.005 FROM game_sessions gs JOIN games g ON g.id = gs.game_id JOIN libraries l ON l.id = g.library_id WHERE l.owner_id = _user_id))
    + CASE WHEN (SELECT created_at FROM user_profiles WHERE user_id = _user_id) < now() - interval '6 months' THEN 0.3 ELSE 0 END
    + CASE WHEN (SELECT created_at FROM user_profiles WHERE user_id = _user_id) < now() - interval '1 year' THEN 0.2 ELSE 0 END
  ))::numeric(5,2);
$$;

-- Auto-set reviewer weight on insert/update
CREATE OR REPLACE FUNCTION public.set_reviewer_weight()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  NEW.reviewer_weight := public.calculate_reviewer_weight(NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_reviewer_weight
BEFORE INSERT OR UPDATE ON public.game_reviews
FOR EACH ROW EXECUTE FUNCTION public.set_reviewer_weight();

-- Verify ownership before allowing review
CREATE OR REPLACE FUNCTION public.verify_review_ownership()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM games g
    JOIN libraries l ON l.id = g.library_id
    WHERE l.owner_id = NEW.user_id
      AND g.catalog_id = NEW.catalog_id
      AND g.ownership_status IN ('owned', 'previously_owned')
  ) THEN
    RAISE EXCEPTION 'You must own or have previously owned this game to review it';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_verify_review_ownership
BEFORE INSERT ON public.game_reviews
FOR EACH ROW EXECUTE FUNCTION public.verify_review_ownership();

-- Grants
GRANT ALL ON public.news_sources TO authenticated, service_role;
GRANT ALL ON public.news_categories TO authenticated, service_role, anon;
GRANT ALL ON public.news_articles TO authenticated, service_role, anon;
GRANT ALL ON public.news_article_categories TO authenticated, service_role, anon;
GRANT ALL ON public.news_article_reactions TO authenticated, service_role;
GRANT ALL ON public.news_bookmarks TO authenticated, service_role;
GRANT ALL ON public.news_article_catalog_links TO authenticated, service_role, anon;
GRANT ALL ON public.game_reviews TO authenticated, service_role, anon;
GRANT ALL ON public.game_review_votes TO authenticated, service_role;
GRANT SELECT ON public.news_sources TO anon;
