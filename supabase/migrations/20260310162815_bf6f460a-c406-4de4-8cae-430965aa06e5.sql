
-- Rating Tags: predefined sentiment/context tags for reviews
CREATE TABLE IF NOT EXISTS public.rating_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  icon TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_positive BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rating_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rating tags are publicly readable" ON public.rating_tags FOR SELECT USING (true);

-- Review Tags: junction linking reviews to selected tags
CREATE TABLE IF NOT EXISTS public.review_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.game_reviews(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.rating_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(review_id, tag_id)
);

CREATE INDEX idx_review_tags_review ON public.review_tags(review_id);
CREATE INDEX idx_review_tags_tag ON public.review_tags(tag_id);

ALTER TABLE public.review_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Review tags are publicly readable" ON public.review_tags FOR SELECT USING (true);
CREATE POLICY "Users can manage own review tags" ON public.review_tags FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.game_reviews gr WHERE gr.id = review_id AND gr.user_id = auth.uid()));
CREATE POLICY "Users can delete own review tags" ON public.review_tags FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.game_reviews gr WHERE gr.id = review_id AND gr.user_id = auth.uid()));

-- Player Count Ratings: per-player-count sub-ratings on reviews
CREATE TABLE IF NOT EXISTS public.review_player_count_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.game_reviews(id) ON DELETE CASCADE,
  player_count INTEGER NOT NULL CHECK (player_count >= 1 AND player_count <= 20),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(review_id, player_count)
);

CREATE INDEX idx_review_pc_ratings_review ON public.review_player_count_ratings(review_id);

ALTER TABLE public.review_player_count_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Player count ratings are publicly readable" ON public.review_player_count_ratings FOR SELECT USING (true);
CREATE POLICY "Users can manage own player count ratings" ON public.review_player_count_ratings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.game_reviews gr WHERE gr.id = review_id AND gr.user_id = auth.uid()));
CREATE POLICY "Users can delete own player count ratings" ON public.review_player_count_ratings FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.game_reviews gr WHERE gr.id = review_id AND gr.user_id = auth.uid()));

-- Add guided prompt fields to game_reviews
ALTER TABLE public.game_reviews
  ADD COLUMN IF NOT EXISTS best_for TEXT,
  ADD COLUMN IF NOT EXISTS skip_if TEXT,
  ADD COLUMN IF NOT EXISTS best_player_count TEXT,
  ADD COLUMN IF NOT EXISTS compared_to TEXT;

-- Seed the predefined rating tags
INSERT INTO public.rating_tags (slug, label, category, icon, is_positive, display_order) VALUES
  -- Player experience tags
  ('great-at-2p', 'Great at 2 players', 'player_count', '👫', true, 1),
  ('great-at-solo', 'Great solo', 'player_count', '🧍', true, 2),
  ('scales-well', 'Scales well', 'player_count', '📏', true, 3),
  ('best-at-full-count', 'Best at max players', 'player_count', '👥', true, 4),
  ('scales-poorly', 'Scales poorly', 'player_count', '📉', false, 5),
  
  -- Complexity tags
  ('easy-to-teach', 'Easy to teach', 'complexity', '📖', true, 10),
  ('gateway-game', 'Great gateway game', 'complexity', '🚪', true, 11),
  ('deep-strategy', 'Deep strategy', 'complexity', '🧠', true, 12),
  ('ap-heavy', 'Analysis paralysis', 'complexity', '🤔', false, 13),
  ('rules-heavy', 'Rules heavy', 'complexity', '📚', false, 14),
  
  -- Experience tags
  ('high-interaction', 'High interaction', 'experience', '🤝', true, 20),
  ('low-downtime', 'Low downtime', 'experience', '⚡', true, 21),
  ('too-long', 'Overstays its welcome', 'experience', '⏰', false, 22),
  ('too-short', 'Too short', 'experience', '⏱️', false, 23),
  ('high-luck', 'Luck heavy', 'experience', '🎲', null, 24),
  ('tense-exciting', 'Tense and exciting', 'experience', '🔥', true, 25),
  ('relaxing', 'Relaxing / chill', 'experience', '😌', true, 26),
  ('cutthroat', 'Cutthroat', 'experience', '⚔️', null, 27),
  
  -- Quality tags
  ('beautiful-art', 'Beautiful artwork', 'quality', '🎨', true, 30),
  ('great-components', 'Great components', 'quality', '✨', true, 31),
  ('poor-components', 'Poor components', 'quality', '👎', false, 32),
  ('good-insert', 'Good box insert', 'quality', '📦', true, 33),
  ('needs-insert', 'Needs better insert', 'quality', '📦', false, 34),
  ('great-theme', 'Theme shines through', 'quality', '🎭', true, 35),
  ('pasted-on-theme', 'Pasted-on theme', 'quality', '🏷️', false, 36),
  
  -- Value tags  
  ('great-value', 'Great value', 'value', '💰', true, 40),
  ('overpriced', 'Overpriced', 'value', '💸', false, 41),
  ('high-replayability', 'Highly replayable', 'value', '🔄', true, 42),
  ('shelf-of-shame', 'Hard to get to table', 'value', '😅', false, 43),
  ('evergreen', 'Evergreen classic', 'value', '🌲', true, 44)
ON CONFLICT (slug) DO NOTHING;
