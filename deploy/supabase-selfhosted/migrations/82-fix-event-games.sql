-- =============================================================================
-- Fix event_games: scheduled_time type + RLS for community event creators
-- =============================================================================

SET LOCAL lock_timeout = '5s';

-- 1. Change scheduled_time from TIMESTAMPTZ to TEXT (it holds time-of-day labels like "18:00")
ALTER TABLE public.event_games
  ALTER COLUMN scheduled_time TYPE TEXT USING scheduled_time::TEXT;

-- 2. Fix RLS: also allow the event creator (created_by) to manage event_games
--    This is needed for community events that aren't tied to a library owner.
DROP POLICY IF EXISTS "Library owners can manage event games" ON public.event_games;
CREATE POLICY "Event managers can manage event games" ON public.event_games
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.library_events le
            LEFT JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id
              AND (
                le.created_by = auth.uid()
                OR (l.id IS NOT NULL AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id)))
              )
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.library_events le
            LEFT JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id
              AND (
                le.created_by = auth.uid()
                OR (l.id IS NOT NULL AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id)))
              )
        )
    );

-- Also fix the same pattern for event_supplies, event_tables, event_table_seats, event_attendee_prefs
DROP POLICY IF EXISTS "Library owners can manage event supplies" ON public.event_supplies;
CREATE POLICY "Event managers can manage event supplies" ON public.event_supplies
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.library_events le
            LEFT JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id
              AND (
                le.created_by = auth.uid()
                OR (l.id IS NOT NULL AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id)))
              )
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.library_events le
            LEFT JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id
              AND (
                le.created_by = auth.uid()
                OR (l.id IS NOT NULL AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id)))
              )
        )
    );

DROP POLICY IF EXISTS "Library owners can manage event tables" ON public.event_tables;
CREATE POLICY "Event managers can manage event tables" ON public.event_tables
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.library_events le
            LEFT JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id
              AND (
                le.created_by = auth.uid()
                OR (l.id IS NOT NULL AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id)))
              )
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.library_events le
            LEFT JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id
              AND (
                le.created_by = auth.uid()
                OR (l.id IS NOT NULL AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id)))
              )
        )
    );

DROP POLICY IF EXISTS "Library owners can manage event seats" ON public.event_table_seats;
CREATE POLICY "Event managers can manage event seats" ON public.event_table_seats
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.event_tables et
            JOIN public.library_events le ON le.id = et.event_id
            LEFT JOIN public.libraries l ON l.id = le.library_id
            WHERE et.id = table_id
              AND (
                le.created_by = auth.uid()
                OR (l.id IS NOT NULL AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id)))
              )
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.event_tables et
            JOIN public.library_events le ON le.id = et.event_id
            LEFT JOIN public.libraries l ON l.id = le.library_id
            WHERE et.id = table_id
              AND (
                le.created_by = auth.uid()
                OR (l.id IS NOT NULL AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id)))
              )
        )
    );

NOTIFY pgrst, 'reload schema';
