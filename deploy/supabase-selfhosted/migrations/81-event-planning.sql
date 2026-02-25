-- =============================================================================
-- Migration 81: Event Planning Suite
-- Adds game lineup, logistics, supply checklists, table assignments,
-- attendee preferences, and event type support
-- =============================================================================

SET LOCAL lock_timeout = '5s';

-- -----------------------------------------------
-- 1. Extend library_events with event type + multi-day + venue fields
-- -----------------------------------------------
ALTER TABLE public.library_events
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'game_night',
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS max_attendees INTEGER,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS venue_name TEXT,
  ADD COLUMN IF NOT EXISTS venue_address TEXT,
  ADD COLUMN IF NOT EXISTS venue_notes TEXT,
  ADD COLUMN IF NOT EXISTS entry_fee TEXT,
  ADD COLUMN IF NOT EXISTS age_restriction TEXT,
  ADD COLUMN IF NOT EXISTS parking_info TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';

-- event_type values: game_night, tournament, convention, meetup, public_event
-- status values: draft, published, cancelled, completed

CREATE INDEX IF NOT EXISTS idx_library_events_type ON public.library_events(event_type);
CREATE INDEX IF NOT EXISTS idx_library_events_status ON public.library_events(status);

-- -----------------------------------------------
-- 2. Event game lineup / schedule
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.library_events(id) ON DELETE CASCADE,
    game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
    catalog_game_id UUID REFERENCES public.game_catalog(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    image_url TEXT,
    scheduled_time TIMESTAMPTZ,
    duration_minutes INTEGER,
    min_players INTEGER,
    max_players INTEGER,
    table_label TEXT,
    notes TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_games_event ON public.event_games(event_id);

-- -----------------------------------------------
-- 3. Supply / bring-list items
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_supplies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.library_events(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    category TEXT NOT NULL DEFAULT 'other',
    claimed_by TEXT,
    claimed_by_user_id UUID,
    is_fulfilled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_supplies_event ON public.event_supplies(event_id);

-- category values: food, drinks, equipment, games, other

-- -----------------------------------------------
-- 4. Table / group assignments
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.library_events(id) ON DELETE CASCADE,
    table_label TEXT NOT NULL,
    game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
    game_title TEXT,
    capacity INTEGER NOT NULL DEFAULT 4,
    notes TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_tables_event ON public.event_tables(event_id);

CREATE TABLE IF NOT EXISTS public.event_table_seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES public.event_tables(id) ON DELETE CASCADE,
    player_name TEXT NOT NULL,
    player_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(table_id, player_name)
);

-- -----------------------------------------------
-- 5. Attendee preferences (what games they want to play / bring)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_attendee_prefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.library_events(id) ON DELETE CASCADE,
    attendee_identifier TEXT NOT NULL,
    attendee_name TEXT,
    attendee_user_id UUID,
    wants_to_play JSONB DEFAULT '[]'::jsonb,
    can_bring JSONB DEFAULT '[]'::jsonb,
    dietary_notes TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(event_id, attendee_identifier)
);

CREATE INDEX IF NOT EXISTS idx_event_attendee_prefs_event ON public.event_attendee_prefs(event_id);

-- -----------------------------------------------
-- 6. RLS Policies
-- -----------------------------------------------
ALTER TABLE public.event_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_table_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendee_prefs ENABLE ROW LEVEL SECURITY;

-- event_games: public read for active libraries, owner/co-owner manage
DROP POLICY IF EXISTS "Public can view event games" ON public.event_games;
CREATE POLICY "Public can view event games" ON public.event_games
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.library_events le
            JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id AND l.is_active = true
        )
    );

DROP POLICY IF EXISTS "Library owners can manage event games" ON public.event_games;
CREATE POLICY "Library owners can manage event games" ON public.event_games
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.library_events le
            JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id))
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.library_events le
            JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id))
        )
    );

-- event_supplies: same pattern
DROP POLICY IF EXISTS "Public can view event supplies" ON public.event_supplies;
CREATE POLICY "Public can view event supplies" ON public.event_supplies
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.library_events le
            JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id AND l.is_active = true
        )
    );

DROP POLICY IF EXISTS "Library owners can manage event supplies" ON public.event_supplies;
CREATE POLICY "Library owners can manage event supplies" ON public.event_supplies
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.library_events le
            JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id))
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.library_events le
            JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id))
        )
    );

-- Allow anyone to claim supplies (update fulfilled/claimed_by)
DROP POLICY IF EXISTS "Anyone can claim supplies" ON public.event_supplies;
CREATE POLICY "Anyone can claim supplies" ON public.event_supplies
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.library_events le
            JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id AND l.is_active = true
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.library_events le
            JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id AND l.is_active = true
        )
    );

-- event_tables + seats: same pattern
DROP POLICY IF EXISTS "Public can view event tables" ON public.event_tables;
CREATE POLICY "Public can view event tables" ON public.event_tables
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.library_events le
            JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id AND l.is_active = true
        )
    );

DROP POLICY IF EXISTS "Library owners can manage event tables" ON public.event_tables;
CREATE POLICY "Library owners can manage event tables" ON public.event_tables
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.library_events le
            JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id))
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.library_events le
            JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id))
        )
    );

DROP POLICY IF EXISTS "Public can view table seats" ON public.event_table_seats;
CREATE POLICY "Public can view table seats" ON public.event_table_seats
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.event_tables et
            JOIN public.library_events le ON le.id = et.event_id
            JOIN public.libraries l ON l.id = le.library_id
            WHERE et.id = table_id AND l.is_active = true
        )
    );

DROP POLICY IF EXISTS "Library owners can manage table seats" ON public.event_table_seats;
CREATE POLICY "Library owners can manage table seats" ON public.event_table_seats
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.event_tables et
            JOIN public.library_events le ON le.id = et.event_id
            JOIN public.libraries l ON l.id = le.library_id
            WHERE et.id = table_id AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id))
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.event_tables et
            JOIN public.library_events le ON le.id = et.event_id
            JOIN public.libraries l ON l.id = le.library_id
            WHERE et.id = table_id AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id))
        )
    );

-- event_attendee_prefs: public read, anyone can insert/update their own
DROP POLICY IF EXISTS "Public can view attendee prefs" ON public.event_attendee_prefs;
CREATE POLICY "Public can view attendee prefs" ON public.event_attendee_prefs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.library_events le
            JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id AND l.is_active = true
        )
    );

DROP POLICY IF EXISTS "Anyone can submit their prefs" ON public.event_attendee_prefs;
CREATE POLICY "Anyone can submit their prefs" ON public.event_attendee_prefs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.library_events le
            JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id AND l.is_active = true
        )
    );

DROP POLICY IF EXISTS "Users can update own prefs" ON public.event_attendee_prefs;
CREATE POLICY "Users can update own prefs" ON public.event_attendee_prefs
    FOR UPDATE USING (
        attendee_user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.library_events le
            JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id))
        )
    );

DROP POLICY IF EXISTS "Library owners can manage attendee prefs" ON public.event_attendee_prefs;
CREATE POLICY "Library owners can manage attendee prefs" ON public.event_attendee_prefs
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.library_events le
            JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id))
        )
    );

-- -----------------------------------------------
-- 7. Update calendar view to include new fields
-- -----------------------------------------------
CREATE OR REPLACE VIEW public.library_calendar_events
WITH (security_invoker = false)
AS
SELECT 
    'standalone'::text as event_type,
    id,
    library_id,
    title,
    description,
    event_date,
    event_location,
    NULL::text as share_token,
    NULL::text as poll_status,
    created_at,
    event_type as event_category,
    end_date,
    status as event_status,
    is_public
FROM public.library_events
UNION ALL
SELECT 
    'poll'::text as event_type,
    id,
    library_id,
    title,
    description,
    event_date,
    event_location,
    share_token,
    status as poll_status,
    created_at,
    'game_night'::text as event_category,
    NULL::timestamptz as end_date,
    status as event_status,
    false as is_public
FROM public.game_polls
WHERE event_date IS NOT NULL AND poll_type = 'game_night' AND status IN ('open', 'closed');
