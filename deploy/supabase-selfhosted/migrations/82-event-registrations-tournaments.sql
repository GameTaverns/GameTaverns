-- =============================================================================
-- Migration 82: Event Registrations, Waitlists & Tournament Support
-- =============================================================================

SET LOCAL lock_timeout = '5s';

-- -----------------------------------------------
-- 1. Event Registrations (caps + waitlists)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.library_events(id) ON DELETE CASCADE,
    attendee_name TEXT NOT NULL,
    attendee_email TEXT,
    attendee_user_id UUID,
    status TEXT NOT NULL DEFAULT 'registered',  -- registered, waitlisted, cancelled
    waitlist_position INTEGER,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    cancelled_at TIMESTAMPTZ,
    notes TEXT,
    UNIQUE(event_id, attendee_name)
);

CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON public.event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_status ON public.event_registrations(event_id, status);

-- -----------------------------------------------
-- 2. Tournament Rounds & Matches
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_tournament_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.library_events(id) ON DELETE CASCADE UNIQUE,
    format TEXT NOT NULL DEFAULT 'single_elimination',  -- single_elimination, double_elimination, round_robin, swiss
    max_rounds INTEGER,
    current_round INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'setup',  -- setup, in_progress, completed
    seed_method TEXT NOT NULL DEFAULT 'random',  -- random, manual, elo
    third_place_match BOOLEAN NOT NULL DEFAULT false,
    points_win INTEGER NOT NULL DEFAULT 3,
    points_draw INTEGER NOT NULL DEFAULT 1,
    points_loss INTEGER NOT NULL DEFAULT 0,
    tiebreaker TEXT NOT NULL DEFAULT 'head_to_head',  -- head_to_head, points_diff, buchholz
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_tournament_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.library_events(id) ON DELETE CASCADE,
    player_name TEXT NOT NULL,
    player_user_id UUID,
    seed INTEGER,
    is_eliminated BOOLEAN NOT NULL DEFAULT false,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 0,
    tiebreaker_score NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(event_id, player_name)
);

CREATE INDEX IF NOT EXISTS idx_event_tournament_players_event ON public.event_tournament_players(event_id);

CREATE TABLE IF NOT EXISTS public.event_tournament_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.library_events(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    match_number INTEGER NOT NULL,
    bracket_position TEXT,  -- For elimination: 'winners', 'losers', 'finals'
    player1_id UUID REFERENCES public.event_tournament_players(id) ON DELETE SET NULL,
    player2_id UUID REFERENCES public.event_tournament_players(id) ON DELETE SET NULL,
    winner_id UUID REFERENCES public.event_tournament_players(id) ON DELETE SET NULL,
    player1_score INTEGER,
    player2_score INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, in_progress, completed, bye
    scheduled_time TIMESTAMPTZ,
    table_label TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_tournament_matches_event ON public.event_tournament_matches(event_id);
CREATE INDEX IF NOT EXISTS idx_event_tournament_matches_round ON public.event_tournament_matches(event_id, round_number);

-- -----------------------------------------------
-- 3. Multi-day schedule blocks
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_schedule_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.library_events(id) ON DELETE CASCADE,
    day_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    block_type TEXT NOT NULL DEFAULT 'activity',  -- activity, break, ceremony, registration, other
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_schedule_blocks_event ON public.event_schedule_blocks(event_id);
CREATE INDEX IF NOT EXISTS idx_event_schedule_blocks_day ON public.event_schedule_blocks(event_id, day_date);

-- -----------------------------------------------
-- 4. RLS Policies
-- -----------------------------------------------
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_tournament_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_tournament_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_schedule_blocks ENABLE ROW LEVEL SECURITY;

-- event_registrations: public read, anyone can register, owners manage
DROP POLICY IF EXISTS "Public can view event registrations" ON public.event_registrations;
CREATE POLICY "Public can view event registrations" ON public.event_registrations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.library_events le
            JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id AND l.is_active = true
        )
    );

DROP POLICY IF EXISTS "Anyone can register for events" ON public.event_registrations;
CREATE POLICY "Anyone can register for events" ON public.event_registrations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.library_events le
            JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id AND l.is_active = true
        )
    );

DROP POLICY IF EXISTS "Users can cancel own registration" ON public.event_registrations;
CREATE POLICY "Users can cancel own registration" ON public.event_registrations
    FOR UPDATE USING (
        attendee_user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.library_events le
            JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id))
        )
    );

DROP POLICY IF EXISTS "Library owners can manage registrations" ON public.event_registrations;
CREATE POLICY "Library owners can manage registrations" ON public.event_registrations
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.library_events le
            JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id))
        )
    );

-- Tournament tables: same owner-manage, public-read pattern
DROP POLICY IF EXISTS "Public can view tournament config" ON public.event_tournament_config;
CREATE POLICY "Public can view tournament config" ON public.event_tournament_config
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.library_events le
            JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id AND l.is_active = true
        )
    );

DROP POLICY IF EXISTS "Library owners can manage tournament config" ON public.event_tournament_config;
CREATE POLICY "Library owners can manage tournament config" ON public.event_tournament_config
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

DROP POLICY IF EXISTS "Public can view tournament players" ON public.event_tournament_players;
CREATE POLICY "Public can view tournament players" ON public.event_tournament_players
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.library_events le
            JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id AND l.is_active = true
        )
    );

DROP POLICY IF EXISTS "Library owners can manage tournament players" ON public.event_tournament_players;
CREATE POLICY "Library owners can manage tournament players" ON public.event_tournament_players
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

DROP POLICY IF EXISTS "Public can view tournament matches" ON public.event_tournament_matches;
CREATE POLICY "Public can view tournament matches" ON public.event_tournament_matches
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.library_events le
            JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id AND l.is_active = true
        )
    );

DROP POLICY IF EXISTS "Library owners can manage tournament matches" ON public.event_tournament_matches;
CREATE POLICY "Library owners can manage tournament matches" ON public.event_tournament_matches
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

-- Schedule blocks
DROP POLICY IF EXISTS "Public can view schedule blocks" ON public.event_schedule_blocks;
CREATE POLICY "Public can view schedule blocks" ON public.event_schedule_blocks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.library_events le
            JOIN public.libraries l ON l.id = le.library_id
            WHERE le.id = event_id AND l.is_active = true
        )
    );

DROP POLICY IF EXISTS "Library owners can manage schedule blocks" ON public.event_schedule_blocks;
CREATE POLICY "Library owners can manage schedule blocks" ON public.event_schedule_blocks
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

-- -----------------------------------------------
-- 5. Public event directory view
-- -----------------------------------------------
DROP VIEW IF EXISTS public.public_event_directory CASCADE;
CREATE VIEW public.public_event_directory
WITH (security_invoker = false)
AS
SELECT
    le.id,
    le.library_id,
    le.title,
    le.description,
    le.event_date,
    le.end_date,
    le.event_type,
    le.event_location,
    le.venue_name,
    le.venue_address,
    le.max_attendees,
    le.entry_fee,
    le.age_restriction,
    le.status,
    l.name as library_name,
    l.slug as library_slug,
    le.created_at,
    (SELECT COUNT(*)::INTEGER FROM public.event_registrations er WHERE er.event_id = le.id AND er.status = 'registered') as registration_count
FROM public.library_events le
JOIN public.libraries l ON l.id = le.library_id
WHERE le.is_public = true
  AND le.status = 'published'
  AND l.is_active = true
  AND le.event_date >= (now() - interval '1 day');

NOTIFY pgrst, 'reload schema';
