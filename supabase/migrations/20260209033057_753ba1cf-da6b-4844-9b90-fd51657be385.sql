-- Allow viewing profiles of forum thread/reply authors
-- This is necessary so forum participants can see each other's display names

DROP POLICY IF EXISTS "Authenticated users can view relevant profiles" ON public.user_profiles;

CREATE POLICY "Authenticated users can view relevant profiles"
  ON public.user_profiles
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- Own profile
      auth.uid() = user_id
      -- Platform admin
      OR has_role(auth.uid(), 'admin')
      -- Share library membership
      OR EXISTS (
        SELECT 1 FROM library_members lm1
        JOIN library_members lm2 ON lm1.library_id = lm2.library_id
        WHERE lm1.user_id = auth.uid() AND lm2.user_id = user_profiles.user_id
      )
      -- Library owner that user is a member of
      OR EXISTS (
        SELECT 1 FROM libraries l
        JOIN library_members lm ON l.id = lm.library_id
        WHERE l.owner_id = user_profiles.user_id AND lm.user_id = auth.uid()
      )
      -- Loan relationship
      OR EXISTS (
        SELECT 1 FROM game_loans gl
        WHERE (gl.borrower_user_id = auth.uid() AND gl.lender_user_id = user_profiles.user_id)
           OR (gl.lender_user_id = auth.uid() AND gl.borrower_user_id = user_profiles.user_id)
      )
      -- Forum thread author (anyone can see profile of thread authors)
      OR EXISTS (
        SELECT 1 FROM forum_threads ft WHERE ft.author_id = user_profiles.user_id
      )
      -- Forum reply author (anyone can see profile of reply authors)
      OR EXISTS (
        SELECT 1 FROM forum_replies fr WHERE fr.author_id = user_profiles.user_id
      )
    )
  );