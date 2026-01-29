-- Fix the view to use security_invoker
DROP VIEW IF EXISTS public.library_calendar_events;

CREATE VIEW public.library_calendar_events
WITH (security_invoker = true) AS
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