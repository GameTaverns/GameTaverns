-- Add explicit INSERT policy for libraries to ensure users can create their own library
-- The existing "Owners can manage their libraries" policy uses ALL but may not properly handle INSERT
-- because the row doesn't exist yet to satisfy USING clause

CREATE POLICY "Authenticated users can create their own library"
ON public.libraries
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);