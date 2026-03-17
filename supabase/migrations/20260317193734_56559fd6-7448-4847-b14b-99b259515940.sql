CREATE TABLE IF NOT EXISTS public.event_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.library_events(id) ON DELETE CASCADE,
    attendee_name TEXT NOT NULL,
    attendee_email TEXT,
    attendee_user_id UUID,
    status TEXT NOT NULL DEFAULT 'registered',
    waitlist_position INTEGER,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    cancelled_at TIMESTAMPTZ,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON public.event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_status ON public.event_registrations(event_id, status);

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read registrations (events are public-facing)
CREATE POLICY "Anyone can view event registrations"
    ON public.event_registrations FOR SELECT
    USING (true);

-- Authenticated users can register
CREATE POLICY "Authenticated users can insert registrations"
    ON public.event_registrations FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Authenticated users can update their own registrations
CREATE POLICY "Users can update own registrations"
    ON public.event_registrations FOR UPDATE
    TO authenticated
    USING (attendee_user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM library_events le
        JOIN libraries l ON l.id = le.library_id
        WHERE le.id = event_id AND (le.created_by = auth.uid() OR l.owner_id = auth.uid())
    ));

-- Event owners can delete registrations
CREATE POLICY "Event owners can delete registrations"
    ON public.event_registrations FOR DELETE
    TO authenticated
    USING (attendee_user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM library_events le
        JOIN libraries l ON l.id = le.library_id
        WHERE le.id = event_id AND (le.created_by = auth.uid() OR l.owner_id = auth.uid())
    ));

-- Allow anon to insert (for guest registrations)
CREATE POLICY "Anon can insert registrations"
    ON public.event_registrations FOR INSERT
    TO anon
    WITH CHECK (true);