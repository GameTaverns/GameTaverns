-- Make achievements publicly readable to avoid RLS recursion with user_achievements
DROP POLICY IF EXISTS "Anyone can view non-secret achievements" ON public.achievements;
DROP POLICY IF EXISTS "Users can view their earned secret achievements" ON public.achievements;

CREATE POLICY "Achievements are viewable by everyone"
ON public.achievements
FOR SELECT
USING (true);
