-- =============================================================================
-- Fix game_admin_data RLS Policies
-- Version: 2.3.5
-- 
-- Drops conflicting dual-policy sets (admin-only vs owner) and replaces
-- with unified policies granting access to library owners, co-owners, and admins.
--
-- Apply with:
--   cat deploy/supabase-selfhosted/migrations/30-fix-game-admin-data-rls.sql | \
--     gt_compose exec -T db psql -U postgres -d postgres
-- =============================================================================

-- Drop the original admin-only policies (from migration 20260118201631)
DROP POLICY IF EXISTS "Admins can view game admin data" ON public.game_admin_data;
DROP POLICY IF EXISTS "Admins can insert game admin data" ON public.game_admin_data;
DROP POLICY IF EXISTS "Admins can update game admin data" ON public.game_admin_data;
DROP POLICY IF EXISTS "Admins can delete game admin data" ON public.game_admin_data;

-- Drop the library-owner policies (from migration 20260128214528)
DROP POLICY IF EXISTS "Library owners can view their game admin data" ON public.game_admin_data;
DROP POLICY IF EXISTS "Library owners can insert game admin data" ON public.game_admin_data;
DROP POLICY IF EXISTS "Library owners can update game admin data" ON public.game_admin_data;
DROP POLICY IF EXISTS "Library owners can delete game admin data" ON public.game_admin_data;

-- Drop any previously attempted unified policies (idempotent)
DROP POLICY IF EXISTS "game_admin_data_select" ON public.game_admin_data;
DROP POLICY IF EXISTS "game_admin_data_insert" ON public.game_admin_data;
DROP POLICY IF EXISTS "game_admin_data_update" ON public.game_admin_data;
DROP POLICY IF EXISTS "game_admin_data_delete" ON public.game_admin_data;

-- Unified SELECT: library owners, co-owners, and platform admins
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

-- Unified INSERT
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

-- Unified UPDATE
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

-- Unified DELETE
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
