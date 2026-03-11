-- =============================================================================
-- GameTaverns Self-Hosted: Anti-Scraping Security Patch
-- Locks 11 tables from anon SELECT to authenticated-only (or admin-only)
-- Version: 88
-- =============================================================================

SET LOCAL lock_timeout = '5s';

-- 1. user_photos → authenticated only
DROP POLICY IF EXISTS "Anyone can view photos" ON public.user_photos;
DO $$ BEGIN
  CREATE POLICY "Photos visible to authenticated users"
    ON public.user_photos FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. user_presence → authenticated only
DROP POLICY IF EXISTS "Presence is publicly readable" ON public.user_presence;
DO $$ BEGIN
  CREATE POLICY "Presence visible to authenticated users"
    ON public.user_presence FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. game_sessions → authenticated only
DROP POLICY IF EXISTS "Sessions viewable by everyone" ON public.game_sessions;
DO $$ BEGIN
  CREATE POLICY "Sessions visible to authenticated users"
    ON public.game_sessions FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. game_session_players → authenticated only
DROP POLICY IF EXISTS "Session players viewable by everyone" ON public.game_session_players;
DO $$ BEGIN
  CREATE POLICY "Session players visible to authenticated users"
    ON public.game_session_players FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. activity_reactions → authenticated only
DROP POLICY IF EXISTS "Reactions are publicly readable" ON public.activity_reactions;
DO $$ BEGIN
  CREATE POLICY "Reactions visible to authenticated users"
    ON public.activity_reactions FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. photo_likes → authenticated only
DROP POLICY IF EXISTS "Anyone can view photo likes" ON public.photo_likes;
DO $$ BEGIN
  CREATE POLICY "Photo likes visible to authenticated users"
    ON public.photo_likes FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7. player_elo_ratings → authenticated only
DROP POLICY IF EXISTS "ELO ratings are publicly readable" ON public.player_elo_ratings;
DROP POLICY IF EXISTS "ELO ratings are publicly viewable" ON public.player_elo_ratings;
DO $$ BEGIN
  CREATE POLICY "ELO ratings visible to authenticated users"
    ON public.player_elo_ratings FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 8. curated_list_votes → authenticated only
DROP POLICY IF EXISTS "Votes are publicly viewable" ON public.curated_list_votes;
DO $$ BEGIN
  CREATE POLICY "Votes visible to authenticated users"
    ON public.curated_list_votes FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9. referral_badges → authenticated only
DROP POLICY IF EXISTS "Referral badges are publicly readable" ON public.referral_badges;
DO $$ BEGIN
  CREATE POLICY "Referral badges visible to authenticated users"
    ON public.referral_badges FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 10. game_wishlist → authenticated only
DROP POLICY IF EXISTS "Anyone can view wishlist entries for summaries" ON public.game_wishlist;
DO $$ BEGIN
  CREATE POLICY "Wishlist visible to authenticated users"
    ON public.game_wishlist FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 11. platform_feedback → admin only (PII: emails, names)
DROP POLICY IF EXISTS "Submitters can read back their own insert" ON public.platform_feedback;
DO $$ BEGIN
  CREATE POLICY "Only admins can read feedback"
    ON public.platform_feedback FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
