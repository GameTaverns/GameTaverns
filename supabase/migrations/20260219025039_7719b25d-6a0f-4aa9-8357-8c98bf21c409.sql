
-- Fix game_admin_data RLS: drop all conflicting policies and replace with clean unified ones

-- Drop the original admin-only policies
DROP POLICY IF EXISTS "Admins can view game admin data" ON public.game_admin_data;
DROP POLICY IF EXISTS "Admins can insert game admin data" ON public.game_admin_data;
DROP POLICY IF EXISTS "Admins can update game admin data" ON public.game_admin_data;
DROP POLICY IF EXISTS "Admins can delete game admin data" ON public.game_admin_data;

-- Drop the library-owner policies added later (may conflict)
DROP POLICY IF EXISTS "Library owners can view their game admin data" ON public.game_admin_data;
DROP POLICY IF EXISTS "Library owners can insert game admin data" ON public.game_admin_data;
DROP POLICY IF EXISTS "Library owners can update game admin data" ON public.game_admin_data;
DROP POLICY IF EXISTS "Library owners can delete game admin data" ON public.game_admin_data;

-- Create clean unified policies: library owners AND co-owners AND admins
CREATE POLICY "game_admin_data_select"
  ON public.game_admin_data FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.games g
      JOIN public.libraries l ON l.id = g.library_id
      WHERE g.id = game_admin_data.game_id
        AND (
          l.owner_id = auth.uid()
          OR is_library_co_owner(auth.uid(), l.id)
        )
    )
  );

CREATE POLICY "game_admin_data_insert"
  ON public.game_admin_data FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.games g
      JOIN public.libraries l ON l.id = g.library_id
      WHERE g.id = game_admin_data.game_id
        AND (
          l.owner_id = auth.uid()
          OR is_library_co_owner(auth.uid(), l.id)
        )
    )
  );

CREATE POLICY "game_admin_data_update"
  ON public.game_admin_data FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.games g
      JOIN public.libraries l ON l.id = g.library_id
      WHERE g.id = game_admin_data.game_id
        AND (
          l.owner_id = auth.uid()
          OR is_library_co_owner(auth.uid(), l.id)
        )
    )
  );

CREATE POLICY "game_admin_data_delete"
  ON public.game_admin_data FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.games g
      JOIN public.libraries l ON l.id = g.library_id
      WHERE g.id = game_admin_data.game_id
        AND (
          l.owner_id = auth.uid()
          OR is_library_co_owner(auth.uid(), l.id)
        )
    )
  );
