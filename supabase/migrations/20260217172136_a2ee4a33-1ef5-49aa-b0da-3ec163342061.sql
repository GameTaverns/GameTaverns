
-- =============================================================================
-- Public User Profile View (for /u/username profile pages)
-- Exposes only safe, non-sensitive profile data for public viewing
-- =============================================================================

CREATE OR REPLACE VIEW public.public_user_profiles AS
SELECT
  up.user_id,
  up.username,
  up.display_name,
  up.avatar_url,
  up.bio,
  up.featured_achievement_id,
  up.created_at AS member_since,
  -- Collection stats (aggregated, no sensitive data)
  COALESCE(game_stats.games_owned, 0) AS games_owned,
  COALESCE(game_stats.expansions_owned, 0) AS expansions_owned,
  COALESCE(session_stats.sessions_logged, 0) AS sessions_logged,
  COALESCE(achievement_stats.achievements_earned, 0) AS achievements_earned,
  COALESCE(achievement_stats.achievement_points, 0) AS achievement_points
FROM public.user_profiles up
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE NOT g.is_expansion) AS games_owned,
    COUNT(*) FILTER (WHERE g.is_expansion) AS expansions_owned
  FROM public.games g
  JOIN public.libraries l ON l.id = g.library_id
  WHERE l.owner_id = up.user_id AND l.is_active = true
) game_stats ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS sessions_logged
  FROM public.game_sessions gs
  JOIN public.games g ON g.id = gs.game_id
  JOIN public.libraries l ON l.id = g.library_id
  WHERE l.owner_id = up.user_id
) session_stats ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS achievements_earned,
    COALESCE(SUM(a.points), 0) AS achievement_points
  FROM public.user_achievements ua
  JOIN public.achievements a ON a.id = ua.achievement_id
  WHERE ua.user_id = up.user_id
) achievement_stats ON true
WHERE up.username IS NOT NULL;

-- Grant read access to all (view is public-safe by design)
GRANT SELECT ON public.public_user_profiles TO anon, authenticated;

-- =============================================================================
-- User Follows table (for Phase 2, but create now to avoid future migration)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows(following_id);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- Anyone can see follow relationships
CREATE POLICY "Follow relationships are public"
  ON public.user_follows FOR SELECT
  USING (true);

-- Users can follow others
CREATE POLICY "Users can follow others"
  ON public.user_follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

-- Users can unfollow
CREATE POLICY "Users can unfollow"
  ON public.user_follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);
