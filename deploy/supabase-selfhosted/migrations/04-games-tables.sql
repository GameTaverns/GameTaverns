-- =============================================================================
-- GameTaverns Self-Hosted: Games & Related Tables
-- =============================================================================

-- ===========================================
-- Games
-- ===========================================
CREATE TABLE IF NOT EXISTS public.games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID REFERENCES public.libraries(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT,
    description TEXT,
    image_url TEXT,
    additional_images TEXT[] DEFAULT '{}',
    
    -- Game details
    min_players INTEGER DEFAULT 1,
    max_players INTEGER DEFAULT 4,
    play_time play_time DEFAULT '45-60 Minutes',
    difficulty difficulty_level DEFAULT '3 - Medium',
    game_type game_type DEFAULT 'Board Game',
    suggested_age TEXT DEFAULT '10+',
    
    -- BGG integration
    bgg_id TEXT,
    bgg_url TEXT,
    
    -- Publisher
    publisher_id UUID REFERENCES public.publishers(id),
    
    -- Expansion tracking
    is_expansion BOOLEAN NOT NULL DEFAULT false,
    parent_game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
    
    -- Collection attributes
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    is_for_sale BOOLEAN NOT NULL DEFAULT false,
    is_coming_soon BOOLEAN NOT NULL DEFAULT false,
    
    -- Sale details
    sale_price NUMERIC,
    sale_condition sale_condition,
    
    -- Physical attributes
    sleeved BOOLEAN DEFAULT false,
    inserts BOOLEAN DEFAULT false,
    upgraded_components BOOLEAN DEFAULT false,
    crowdfunded BOOLEAN DEFAULT false,
    in_base_game_box BOOLEAN DEFAULT false,
    
    -- Location
    location_room TEXT,
    location_shelf TEXT,
    location_misc TEXT,
    
    -- Media
    youtube_videos TEXT[] DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_games_library ON public.games(library_id);
CREATE INDEX IF NOT EXISTS idx_games_slug ON public.games(slug);
CREATE INDEX IF NOT EXISTS idx_games_title ON public.games(title);
CREATE UNIQUE INDEX IF NOT EXISTS idx_games_slug_library ON public.games(slug, library_id);

-- ===========================================
-- Game Admin Data (private purchase info)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.game_admin_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL UNIQUE REFERENCES public.games(id) ON DELETE CASCADE,
    purchase_date DATE,
    purchase_price NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- Game Mechanics (junction table)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.game_mechanics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    mechanic_id UUID NOT NULL REFERENCES public.mechanics(id) ON DELETE CASCADE,
    UNIQUE(game_id, mechanic_id)
);

-- ===========================================
-- Game Ratings
-- ===========================================
CREATE TABLE IF NOT EXISTS public.game_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    guest_identifier TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    ip_address TEXT,
    device_fingerprint TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(game_id, guest_identifier)
);

CREATE INDEX IF NOT EXISTS idx_game_ratings_game ON public.game_ratings(game_id);

-- ===========================================
-- Game Wishlist
-- ===========================================
CREATE TABLE IF NOT EXISTS public.game_wishlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    guest_identifier TEXT NOT NULL,
    guest_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(game_id, guest_identifier)
);

CREATE INDEX IF NOT EXISTS idx_game_wishlist_game ON public.game_wishlist(game_id);

-- ===========================================
-- Game Messages (encrypted contact forms)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.game_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    sender_name_encrypted TEXT,
    sender_email_encrypted TEXT,
    message_encrypted TEXT,
    sender_ip_encrypted TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_messages_game ON public.game_messages(game_id);

-- ===========================================
-- Game Sessions (play logs)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    played_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_minutes INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_game ON public.game_sessions(game_id);

-- ===========================================
-- Game Session Players
-- ===========================================
CREATE TABLE IF NOT EXISTS public.game_session_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    player_name TEXT NOT NULL,
    score INTEGER,
    is_winner BOOLEAN NOT NULL DEFAULT false,
    is_first_play BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- Game Loans (lending system)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.game_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    lender_user_id UUID NOT NULL,
    borrower_user_id UUID NOT NULL,
    status loan_status NOT NULL DEFAULT 'requested',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ,
    borrowed_at TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    lender_notes TEXT,
    borrower_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_loans_library ON public.game_loans(library_id);
CREATE INDEX IF NOT EXISTS idx_game_loans_borrower ON public.game_loans(borrower_user_id);
CREATE INDEX IF NOT EXISTS idx_game_loans_lender ON public.game_loans(lender_user_id);

-- ===========================================
-- Borrower Ratings
-- ===========================================
CREATE TABLE IF NOT EXISTS public.borrower_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL UNIQUE REFERENCES public.game_loans(id) ON DELETE CASCADE,
    rated_user_id UUID NOT NULL,
    rated_by_user_id UUID NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
