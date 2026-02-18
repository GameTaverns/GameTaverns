-- Step 2: Add co_owner helper function and update moderator check to include co_owners

CREATE OR REPLACE FUNCTION public.is_library_co_owner(_user_id uuid, _library_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_members
    WHERE user_id = _user_id
      AND library_id = _library_id
      AND role::text = 'co_owner'
  ) OR EXISTS (
    SELECT 1 FROM public.libraries
    WHERE id = _library_id AND owner_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_library_moderator(_user_id uuid, _library_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_members
    WHERE user_id = _user_id 
    AND library_id = _library_id 
    AND role::text IN ('moderator', 'co_owner')
  ) OR EXISTS (
    SELECT 1 FROM public.libraries
    WHERE id = _library_id AND owner_id = _user_id
  ) OR public.has_role_level(_user_id, 'staff')
$$;