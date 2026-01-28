-- Create enum for suspension actions
CREATE TYPE public.suspension_action AS ENUM ('suspended', 'unsuspended');

-- Create library_suspensions table for audit trail
CREATE TABLE public.library_suspensions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id uuid NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
    action suspension_action NOT NULL,
    reason text,
    performed_by uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_library_suspensions_library_id ON public.library_suspensions(library_id);
CREATE INDEX idx_library_suspensions_created_at ON public.library_suspensions(created_at DESC);

-- Enable RLS
ALTER TABLE public.library_suspensions ENABLE ROW LEVEL SECURITY;

-- Admins can view all suspension history
CREATE POLICY "Admins can view suspension history"
ON public.library_suspensions
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can create suspension records
CREATE POLICY "Admins can create suspension records"
ON public.library_suspensions
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Library owners can view their own suspension history
CREATE POLICY "Owners can view their library suspension history"
ON public.library_suspensions
FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.libraries 
    WHERE libraries.id = library_suspensions.library_id 
    AND libraries.owner_id = auth.uid()
));