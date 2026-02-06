-- Add explicit INSERT policy for game_polls
-- The existing "Library owners can manage their polls" policy is FOR ALL,
-- but INSERT operations need explicit WITH CHECK. Create a dedicated INSERT policy.

DROP POLICY IF EXISTS "Library owners can insert polls" ON public.game_polls;

CREATE POLICY "Library owners can insert polls" 
ON public.game_polls 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.libraries
    WHERE libraries.id = game_polls.library_id 
    AND libraries.owner_id = auth.uid()
  ) 
  OR public.has_role(auth.uid(), 'admin')
);