
-- Convention Staff: explicit per-event volunteer/staff assignment
CREATE TABLE IF NOT EXISTS public.convention_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    convention_event_id UUID NOT NULL REFERENCES public.convention_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'volunteer',  -- 'volunteer', 'lead', 'admin'
    display_name TEXT,
    assigned_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(convention_event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_convention_staff_event ON public.convention_staff(convention_event_id);
CREATE INDEX IF NOT EXISTS idx_convention_staff_user ON public.convention_staff(user_id);

-- Enable RLS
ALTER TABLE public.convention_staff ENABLE ROW LEVEL SECURITY;

-- Security definer function to check convention staff membership
CREATE OR REPLACE FUNCTION public.is_convention_staff(_user_id uuid, _convention_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.convention_staff
    WHERE user_id = _user_id
      AND convention_event_id = _convention_event_id
  )
$$;

-- Also check if user is convention staff by event_id (library_events.id)
CREATE OR REPLACE FUNCTION public.is_convention_staff_by_event(_user_id uuid, _event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.convention_staff cs
    JOIN public.convention_events ce ON ce.id = cs.convention_event_id
    WHERE cs.user_id = _user_id
      AND ce.event_id = _event_id
  ) OR EXISTS (
    -- Event creator or library owner always has access
    SELECT 1 FROM public.library_events le
    JOIN public.libraries l ON l.id = le.library_id
    WHERE le.id = _event_id
      AND (le.created_by_user_id = _user_id OR l.owner_id = _user_id)
  )
$$;

-- RLS: Staff can read their own event's staff list
CREATE POLICY "Convention staff can view their event staff"
ON public.convention_staff FOR SELECT
TO authenticated
USING (
  public.is_convention_staff(auth.uid(), convention_event_id)
  OR EXISTS (
    SELECT 1 FROM public.convention_events ce
    JOIN public.library_events le ON le.id = ce.event_id
    JOIN public.libraries l ON l.id = le.library_id
    WHERE ce.id = convention_event_id
      AND (le.created_by_user_id = auth.uid() OR l.owner_id = auth.uid())
  )
);

-- RLS: Only event owner can manage staff
CREATE POLICY "Event owners can manage convention staff"
ON public.convention_staff FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.convention_events ce
    JOIN public.library_events le ON le.id = ce.event_id
    JOIN public.libraries l ON l.id = le.library_id
    WHERE ce.id = convention_event_id
      AND (le.created_by_user_id = auth.uid() OR l.owner_id = auth.uid())
  )
);

CREATE POLICY "Event owners can update convention staff"
ON public.convention_staff FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.convention_events ce
    JOIN public.library_events le ON le.id = ce.event_id
    JOIN public.libraries l ON l.id = le.library_id
    WHERE ce.id = convention_event_id
      AND (le.created_by_user_id = auth.uid() OR l.owner_id = auth.uid())
  )
);

CREATE POLICY "Event owners can delete convention staff"
ON public.convention_staff FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.convention_events ce
    JOIN public.library_events le ON le.id = ce.event_id
    JOIN public.libraries l ON l.id = le.library_id
    WHERE ce.id = convention_event_id
      AND (le.created_by_user_id = auth.uid() OR l.owner_id = auth.uid())
  )
);
