-- Allow library members (and owners) to view votes on polls in their library
CREATE POLICY "Members can view votes on library polls"
ON public.poll_votes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM game_polls gp
    WHERE gp.id = poll_votes.poll_id
    AND is_library_member(auth.uid(), gp.library_id)
  )
);