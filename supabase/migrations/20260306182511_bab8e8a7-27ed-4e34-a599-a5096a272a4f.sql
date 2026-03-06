ALTER TABLE public.club_libraries DROP COLUMN IF EXISTS is_visible;

-- Drop the RLS policy for visibility toggling if it exists
DROP POLICY IF EXISTS "Club owners and library owners can update visibility" ON public.club_libraries;