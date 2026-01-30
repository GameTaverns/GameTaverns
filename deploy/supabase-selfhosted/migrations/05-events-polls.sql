-- =============================================================================
-- GameTaverns Self-Hosted: Events & Polls
-- =============================================================================

-- ===========================================
-- Library Events
-- ===========================================
CREATE TABLE IF NOT EXISTS public.library_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    event_location TEXT,
    discord_thread_id TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_library_events_library ON public.library_events(library_id);
CREATE INDEX IF NOT EXISTS idx_library_events_date ON public.library_events(event_date);

-- ===========================================
-- Game Polls
-- ===========================================
CREATE TABLE IF NOT EXISTS public.game_polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    poll_type TEXT NOT NULL DEFAULT 'quick',
    status TEXT NOT NULL DEFAULT 'open',
    event_date TIMESTAMPTZ,
    event_location TEXT,
    voting_ends_at TIMESTAMPTZ,
    max_votes_per_user INTEGER DEFAULT 1,
    show_results_before_close BOOLEAN DEFAULT false,
    share_token TEXT DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_polls_library ON public.game_polls(library_id);
CREATE INDEX IF NOT EXISTS idx_game_polls_share_token ON public.game_polls(share_token);

-- ===========================================
-- Poll Options
-- ===========================================
CREATE TABLE IF NOT EXISTS public.poll_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES public.game_polls(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    display_order INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- Poll Votes
-- ===========================================
CREATE TABLE IF NOT EXISTS public.poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES public.game_polls(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
    voter_identifier TEXT NOT NULL,
    voter_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(poll_id, option_id, voter_identifier)
);

-- ===========================================
-- Game Night RSVPs
-- ===========================================
CREATE TABLE IF NOT EXISTS public.game_night_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES public.game_polls(id) ON DELETE CASCADE,
    guest_identifier TEXT NOT NULL,
    guest_name TEXT,
    status TEXT NOT NULL DEFAULT 'going',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(poll_id, guest_identifier)
);
