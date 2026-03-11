-- Fix misnamed "service role" policies that were actually on {public} role
-- Also restrict SELECT on reaction/vote/video tables to authenticated users
-- Ref: Security hardening audit 2026-03-11

SET LOCAL lock_timeout = '5s';

-- #1: user_achievements
DROP POLICY IF EXISTS "Service role can manage user achievements" ON public.user_achievements;
CREATE POLICY "Service role can manage user achievements" ON public.user_achievements
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- #2: player_elo_ratings
DROP POLICY IF EXISTS "System can manage ELO ratings" ON public.player_elo_ratings;
CREATE POLICY "System can manage ELO ratings" ON public.player_elo_ratings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- #3: catalog_scraper_state
DROP POLICY IF EXISTS "Service role full access" ON public.catalog_scraper_state;
CREATE POLICY "Service role full access" ON public.catalog_scraper_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- #4: game_catalog
DROP POLICY IF EXISTS "Service role can manage catalog" ON public.game_catalog;
CREATE POLICY "Service role can manage catalog" ON public.game_catalog
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- #6: audit_log
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.audit_log;
CREATE POLICY "Service role can insert audit logs" ON public.audit_log
  FOR INSERT TO service_role WITH CHECK (true);

-- #7: import_item_errors
DROP POLICY IF EXISTS "Service role can insert import errors" ON public.import_item_errors;
CREATE POLICY "Service role can insert import errors" ON public.import_item_errors
  FOR INSERT TO service_role WITH CHECK (true);

-- #8: import_jobs
DROP POLICY IF EXISTS "Service role can update import jobs" ON public.import_jobs;
CREATE POLICY "Service role can update import jobs" ON public.import_jobs
  FOR UPDATE TO service_role USING (true);

-- #10: system_logs
DROP POLICY IF EXISTS "Service role can insert logs" ON public.system_logs;
CREATE POLICY "Service role can insert logs" ON public.system_logs
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view logs" ON public.system_logs;
CREATE POLICY "Admins can view logs" ON public.system_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Service role can delete logs" ON public.system_logs;
CREATE POLICY "Service role can delete logs" ON public.system_logs
  FOR DELETE TO service_role USING (true);

-- #13: news_article_reactions
DROP POLICY IF EXISTS "Anyone can view article reactions" ON public.news_article_reactions;
CREATE POLICY "Article reactions visible to authenticated users" ON public.news_article_reactions
  FOR SELECT TO authenticated USING (true);

-- #14: game_review_votes
DROP POLICY IF EXISTS "Anyone can view review votes" ON public.game_review_votes;
CREATE POLICY "Review votes visible to authenticated users" ON public.game_review_votes
  FOR SELECT TO authenticated USING (true);

-- #15: catalog_videos
DROP POLICY IF EXISTS "Anyone can view catalog videos" ON public.catalog_videos;
CREATE POLICY "Catalog videos visible to authenticated users" ON public.catalog_videos
  FOR SELECT TO authenticated USING (true);

NOTIFY pgrst, 'reload schema';
