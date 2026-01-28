-- Add policies for library owners to manage game_mechanics for their games

-- Allow library owners to insert game_mechanics for their games
CREATE POLICY "Library owners can insert game_mechanics"
ON public.game_mechanics FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM games g
    JOIN libraries l ON l.id = g.library_id
    WHERE g.id = game_mechanics.game_id AND l.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Allow library owners to delete game_mechanics for their games
CREATE POLICY "Library owners can delete game_mechanics"
ON public.game_mechanics FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM games g
    JOIN libraries l ON l.id = g.library_id
    WHERE g.id = game_mechanics.game_id AND l.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Allow library owners to update game_mechanics for their games
CREATE POLICY "Library owners can update game_mechanics"
ON public.game_mechanics FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM games g
    JOIN libraries l ON l.id = g.library_id
    WHERE g.id = game_mechanics.game_id AND l.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);