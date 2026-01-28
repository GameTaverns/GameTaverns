-- Allow library owners to update messages (mark as read) for games in their library
CREATE POLICY "Library owners can update messages for their games"
ON public.game_messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM games g
    JOIN libraries l ON l.id = g.library_id
    WHERE g.id = game_messages.game_id
    AND l.owner_id = auth.uid()
  )
);

-- Also allow library owners to view messages for their games
CREATE POLICY "Library owners can view messages for their games"
ON public.game_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM games g
    JOIN libraries l ON l.id = g.library_id
    WHERE g.id = game_messages.game_id
    AND l.owner_id = auth.uid()
  )
);

-- Allow library owners to delete messages for their games
CREATE POLICY "Library owners can delete messages for their games"
ON public.game_messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM games g
    JOIN libraries l ON l.id = g.library_id
    WHERE g.id = game_messages.game_id
    AND l.owner_id = auth.uid()
  )
);