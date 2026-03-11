
-- FIX 1: activity_events — lock to authenticated
DROP POLICY IF EXISTS "Activity events are publicly readable" ON public.activity_events;
CREATE POLICY "Activity events visible to authenticated users"
  ON public.activity_events FOR SELECT TO authenticated
  USING (true);

-- FIX 3a: user_follows — lock to authenticated
DROP POLICY IF EXISTS "Follow relationships are public" ON public.user_follows;
CREATE POLICY "Follow relationships visible to authenticated users"
  ON public.user_follows FOR SELECT TO authenticated
  USING (true);

-- FIX 3b: library_followers — lock to authenticated
DROP POLICY IF EXISTS "Anyone can view library followers count" ON public.library_followers;
CREATE POLICY "Library followers visible to authenticated users"
  ON public.library_followers FOR SELECT TO authenticated
  USING (true);

-- FIX 4: games_public — filter to active libraries
CREATE OR REPLACE VIEW public.games_public AS
SELECT
  g.id, g.library_id, g.title, g.slug, g.description, g.image_url,
  g.additional_images, g.min_players, g.max_players, g.play_time,
  g.difficulty, g.game_type, g.suggested_age, g.bgg_id, g.bgg_url,
  g.publisher_id, g.is_expansion, g.parent_game_id, g.is_favorite,
  g.is_for_sale, g.is_coming_soon, g.is_unplayed, g.sale_price,
  g.sale_condition, g.sleeved, g.inserts, g.upgraded_components,
  g.crowdfunded, g.in_base_game_box, g.genre, g.youtube_videos,
  g.copies_owned, g.upc, g.catalog_id, g.ownership_status,
  g.created_at, g.updated_at
FROM games g
JOIN libraries l ON l.id = g.library_id
WHERE l.is_active = true;

GRANT SELECT ON public.games_public TO anon, authenticated;

-- FIX 5: catalog_ratings — lock to authenticated
DROP POLICY IF EXISTS "Catalog ratings are publicly readable" ON public.catalog_ratings;
CREATE POLICY "Catalog ratings visible to authenticated users"
  ON public.catalog_ratings FOR SELECT TO authenticated
  USING (true);

-- Safe public view for ratings (no fingerprint/IP)
CREATE OR REPLACE VIEW public.catalog_ratings_public AS
SELECT id, catalog_id, rating, source, created_at, updated_at
FROM public.catalog_ratings;

GRANT SELECT ON public.catalog_ratings_public TO anon, authenticated;
