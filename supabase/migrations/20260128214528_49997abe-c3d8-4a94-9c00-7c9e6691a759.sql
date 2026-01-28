-- Add policies for library owners to manage game_admin_data for their games

-- Allow library owners to view game admin data for their games
CREATE POLICY "Library owners can view their game admin data"
ON public.game_admin_data FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM games g
    JOIN libraries l ON l.id = g.library_id
    WHERE g.id = game_admin_data.game_id AND l.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Allow library owners to insert game admin data for their games
CREATE POLICY "Library owners can insert game admin data"
ON public.game_admin_data FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM games g
    JOIN libraries l ON l.id = g.library_id
    WHERE g.id = game_admin_data.game_id AND l.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Allow library owners to update game admin data for their games
CREATE POLICY "Library owners can update game admin data"
ON public.game_admin_data FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM games g
    JOIN libraries l ON l.id = g.library_id
    WHERE g.id = game_admin_data.game_id AND l.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Allow library owners to delete game admin data for their games
CREATE POLICY "Library owners can delete game admin data"
ON public.game_admin_data FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM games g
    JOIN libraries l ON l.id = g.library_id
    WHERE g.id = game_admin_data.game_id AND l.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);