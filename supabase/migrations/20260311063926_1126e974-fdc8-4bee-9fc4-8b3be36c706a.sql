
-- 1. user_photos
DROP POLICY IF EXISTS "Anyone can view photos" ON public.user_photos;
CREATE POLICY "Photos visible to authenticated users"
  ON public.user_photos FOR SELECT TO authenticated USING (true);

-- 2. user_presence
DROP POLICY IF EXISTS "Presence is publicly readable" ON public.user_presence;
CREATE POLICY "Presence visible to authenticated users"
  ON public.user_presence FOR SELECT TO authenticated USING (true);

-- 3. game_sessions
DROP POLICY IF EXISTS "Sessions viewable by everyone" ON public.game_sessions;
CREATE POLICY "Sessions visible to authenticated users"
  ON public.game_sessions FOR SELECT TO authenticated USING (true);

-- 4. game_session_players
DROP POLICY IF EXISTS "Session players viewable by everyone" ON public.game_session_players;
CREATE POLICY "Session players visible to authenticated users"
  ON public.game_session_players FOR SELECT TO authenticated USING (true);

-- 5. activity_reactions
DROP POLICY IF EXISTS "Reactions are publicly readable" ON public.activity_reactions;
CREATE POLICY "Reactions visible to authenticated users"
  ON public.activity_reactions FOR SELECT TO authenticated USING (true);

-- 6. photo_likes
DROP POLICY IF EXISTS "Anyone can view photo likes" ON public.photo_likes;
CREATE POLICY "Photo likes visible to authenticated users"
  ON public.photo_likes FOR SELECT TO authenticated USING (true);

-- 7. player_elo_ratings
DROP POLICY IF EXISTS "ELO ratings are publicly readable" ON public.player_elo_ratings;
DROP POLICY IF EXISTS "ELO ratings are publicly viewable" ON public.player_elo_ratings;
CREATE POLICY "ELO ratings visible to authenticated users"
  ON public.player_elo_ratings FOR SELECT TO authenticated USING (true);

-- 8. curated_list_votes
DROP POLICY IF EXISTS "Votes are publicly viewable" ON public.curated_list_votes;
CREATE POLICY "Votes visible to authenticated users"
  ON public.curated_list_votes FOR SELECT TO authenticated USING (true);

-- 9. referral_badges
DROP POLICY IF EXISTS "Referral badges are publicly readable" ON public.referral_badges;
CREATE POLICY "Referral badges visible to authenticated users"
  ON public.referral_badges FOR SELECT TO authenticated USING (true);

-- 10. game_wishlist
DROP POLICY IF EXISTS "Anyone can view wishlist entries for summaries" ON public.game_wishlist;
CREATE POLICY "Wishlist visible to authenticated users"
  ON public.game_wishlist FOR SELECT TO authenticated USING (true);

-- 11. platform_feedback (PII: emails, names) → admin only
DROP POLICY IF EXISTS "Submitters can read back their own insert" ON public.platform_feedback;
CREATE POLICY "Only admins can read feedback"
  ON public.platform_feedback FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
