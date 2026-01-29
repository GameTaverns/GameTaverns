-- Create library_events table for standalone events (not tied to polls)
CREATE TABLE public.library_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    event_location TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.library_events ENABLE ROW LEVEL SECURITY;

-- Public can view events for active libraries
CREATE POLICY "Public can view events in active libraries"
ON public.library_events
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.libraries
        WHERE libraries.id = library_events.library_id
        AND libraries.is_active = true
    )
);

-- Library owners can manage their events
CREATE POLICY "Library owners can manage their events"
ON public.library_events
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.libraries
        WHERE libraries.id = library_events.library_id
        AND libraries.owner_id = auth.uid()
    ) OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.libraries
        WHERE libraries.id = library_events.library_id
        AND libraries.owner_id = auth.uid()
    ) OR has_role(auth.uid(), 'admin'::app_role)
);

-- Add updated_at trigger
CREATE TRIGGER update_library_events_updated_at
    BEFORE UPDATE ON public.library_events
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create a view that combines poll events and standalone events for easy querying
CREATE VIEW public.library_calendar_events AS
SELECT 
    'poll' as event_type,
    gp.id,
    gp.library_id,
    gp.title,
    gp.description,
    gp.event_date,
    gp.event_location,
    gp.share_token,
    gp.status as poll_status,
    gp.created_at
FROM public.game_polls gp
WHERE gp.poll_type = 'game_night' 
AND gp.event_date IS NOT NULL
AND gp.status IN ('open', 'closed')

UNION ALL

SELECT 
    'standalone' as event_type,
    le.id,
    le.library_id,
    le.title,
    le.description,
    le.event_date,
    le.event_location,
    NULL as share_token,
    NULL as poll_status,
    le.created_at
FROM public.library_events le;