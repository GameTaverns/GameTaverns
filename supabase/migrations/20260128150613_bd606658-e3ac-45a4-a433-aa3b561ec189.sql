-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Libraries are viewable by everyone" ON public.libraries;

-- Create a new policy that allows reading ANY library (for suspension detection)
-- The application code handles what to show based on is_active status
CREATE POLICY "Anyone can read library info"
ON public.libraries FOR SELECT
USING (true);