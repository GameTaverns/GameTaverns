-- Fix infinite recursion in achievements RLS policy
-- The current policy checks user_achievements which joins back to achievements

-- Drop the problematic policy
DROP POLICY IF EXISTS "Achievements are viewable by everyone" ON public.achievements;

-- Create a simpler policy that doesn't cause recursion
-- Non-secret achievements are always visible, secret achievements require a separate check
CREATE POLICY "Anyone can view non-secret achievements"
ON public.achievements
FOR SELECT
USING (is_secret = false);

-- Secret achievements visible only to users who earned them (separate policy)
CREATE POLICY "Users can view their earned secret achievements"
ON public.achievements
FOR SELECT
USING (
  is_secret = true 
  AND auth.uid() IN (
    SELECT user_id FROM public.user_achievements WHERE achievement_id = achievements.id
  )
);