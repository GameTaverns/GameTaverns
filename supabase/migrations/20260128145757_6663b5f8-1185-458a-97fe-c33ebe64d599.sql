-- Drop the existing policy
DROP POLICY IF EXISTS "Owners can manage their libraries" ON public.libraries;

-- Create separate policies for owners and admins
CREATE POLICY "Owners can manage their libraries" 
ON public.libraries 
FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Admins can manage all libraries"
ON public.libraries
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));