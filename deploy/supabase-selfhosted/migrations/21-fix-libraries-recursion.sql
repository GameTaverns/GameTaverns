-- =============================================================================
-- GameTaverns Self-Hosted: Fix Infinite Recursion in Libraries RLS
-- Version: 2.3.5
-- 
-- This fixes the "infinite recursion detected in policy for relation libraries"
-- error caused by policies that query library_members -> libraries
-- =============================================================================

-- Drop ALL existing policies on libraries to start fresh
DROP POLICY IF EXISTS "Admins can manage all libraries" ON public.libraries;
DROP POLICY IF EXISTS "Anonymous users can view active libraries" ON public.libraries;
DROP POLICY IF EXISTS "Authenticated users can create libraries" ON public.libraries;
DROP POLICY IF EXISTS "Authenticated users can create their own library" ON public.libraries;
DROP POLICY IF EXISTS "Authenticated users can view libraries" ON public.libraries;
DROP POLICY IF EXISTS "Owners can delete own libraries" ON public.libraries;
DROP POLICY IF EXISTS "Owners can manage their libraries" ON public.libraries;
DROP POLICY IF EXISTS "Owners can update own libraries" ON public.libraries;
DROP POLICY IF EXISTS "Public can view active libraries" ON public.libraries;
DROP POLICY IF EXISTS "Users can create libraries" ON public.libraries;
DROP POLICY IF EXISTS "Users can create own libraries" ON public.libraries;
DROP POLICY IF EXISTS "Users can view accessible libraries" ON public.libraries;
DROP POLICY IF EXISTS "Users can view their libraries" ON public.libraries;
DROP POLICY IF EXISTS "Members can view libraries they belong to" ON public.libraries;

-- =============================================================================
-- Recreate CLEAN policies that don't cause recursion
-- =============================================================================

-- SELECT: Anon users can view active libraries
CREATE POLICY "anon_view_active_libraries" ON public.libraries
  FOR SELECT TO anon
  USING (is_active = true);

-- SELECT: Authenticated users can view all libraries (simple, no subquery to avoid recursion)
CREATE POLICY "auth_view_libraries" ON public.libraries
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: Users can create their own library
CREATE POLICY "users_create_own_library" ON public.libraries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- UPDATE: Owners can update their libraries
CREATE POLICY "owners_update_library" ON public.libraries
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- DELETE: Owners can delete their libraries
CREATE POLICY "owners_delete_library" ON public.libraries
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- ALL: Admins can manage all libraries
CREATE POLICY "admins_manage_libraries" ON public.libraries
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- =============================================================================
-- Verify RLS is enabled
-- =============================================================================
ALTER TABLE public.libraries ENABLE ROW LEVEL SECURITY;

-- Success message
DO $$ BEGIN RAISE NOTICE 'Libraries RLS policies recreated without recursion'; END $$;
