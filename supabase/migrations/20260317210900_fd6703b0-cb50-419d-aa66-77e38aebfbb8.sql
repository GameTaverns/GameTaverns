
-- Add new RSVP fields to event_registrations
ALTER TABLE public.event_registrations 
  ADD COLUMN IF NOT EXISTS bringing_text TEXT,
  ADD COLUMN IF NOT EXISTS guest_count INTEGER NOT NULL DEFAULT 0;

-- Refresh PostgREST cache
NOTIFY pgrst, 'reload schema';
