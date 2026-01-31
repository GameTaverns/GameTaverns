-- =============================================================================
-- Part 2: Role Hierarchy Functions
-- These functions can only be created AFTER the new enum values are committed
-- =============================================================================

-- Create a helper function to check role hierarchy level
-- Higher tier = more privileges, lower number
CREATE OR REPLACE FUNCTION public.get_role_tier(_role app_role)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = 'public'
AS $$
  SELECT CASE _role
    WHEN 'admin' THEN 1
    WHEN 'staff' THEN 2
    WHEN 'owner' THEN 3
    WHEN 'moderator' THEN 4
    ELSE 5
  END;
$$;

-- Create a function to check if user has at least a certain role level
-- e.g., has_role_level(uid, 'staff') returns true if user is admin or staff
CREATE OR REPLACE FUNCTION public.has_role_level(_user_id uuid, _min_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND public.get_role_tier(role) <= public.get_role_tier(_min_role)
  )
$$;

-- Update the is_library_moderator function to also check for staff/owner platform roles
CREATE OR REPLACE FUNCTION public.is_library_moderator(_user_id uuid, _library_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    -- User is a moderator in the specific library
    SELECT 1 FROM public.library_members
    WHERE user_id = _user_id 
    AND library_id = _library_id 
    AND role = 'moderator'
  ) OR EXISTS (
    -- User is the library owner
    SELECT 1 FROM public.libraries
    WHERE id = _library_id AND owner_id = _user_id
  ) OR public.has_role_level(_user_id, 'staff')
$$;