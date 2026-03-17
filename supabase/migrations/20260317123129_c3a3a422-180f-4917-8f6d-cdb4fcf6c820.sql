
-- Quest completions table: tracks when users complete multi-step quest chains
CREATE TABLE IF NOT EXISTS public.user_quest_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  quest_slug TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  bonus_points_awarded INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, quest_slug)
);

ALTER TABLE public.user_quest_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own quest completions"
  ON public.user_quest_completions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view any quest completions (leaderboard)"
  ON public.user_quest_completions FOR SELECT
  USING (true);

CREATE POLICY "System can insert quest completions"
  ON public.user_quest_completions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Leaderboard view: aggregates achievement points per user
CREATE OR REPLACE VIEW public.achievement_leaderboard AS
SELECT
  up.user_id,
  up.username,
  up.display_name,
  up.avatar_url,
  COALESCE(SUM(a.points), 0)::INTEGER AS total_points,
  COUNT(ua.id)::INTEGER AS achievements_earned,
  COALESCE(qc.quest_bonus, 0)::INTEGER AS quest_bonus,
  (COALESCE(SUM(a.points), 0) + COALESCE(qc.quest_bonus, 0))::INTEGER AS grand_total
FROM public.user_profiles up
LEFT JOIN public.user_achievements ua ON ua.user_id = up.user_id
LEFT JOIN public.achievements a ON a.id = ua.achievement_id
LEFT JOIN (
  SELECT user_id, SUM(bonus_points_awarded)::INTEGER AS quest_bonus
  FROM public.user_quest_completions
  GROUP BY user_id
) qc ON qc.user_id = up.user_id
GROUP BY up.user_id, up.username, up.display_name, up.avatar_url, qc.quest_bonus
HAVING COALESCE(SUM(a.points), 0) + COALESCE(qc.quest_bonus, 0) > 0
ORDER BY grand_total DESC;
