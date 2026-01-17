-- Drop the incorrect permissive policy we just created
DROP POLICY IF EXISTS "Public can view games via view" ON public.games;

-- The base games table should ONLY be accessible to admins
-- Public access should go through games_public view