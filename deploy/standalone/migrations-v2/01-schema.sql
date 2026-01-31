-- Game Haven v2 - Database Schema
-- Auto-applied on first container boot

-- =====================
-- Custom Types (Enums)
-- =====================

DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE difficulty_level AS ENUM (
        '1 - Light', '2 - Medium Light', '3 - Medium', 
        '4 - Medium Heavy', '5 - Heavy'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE game_type AS ENUM (
        'Board Game', 'Card Game', 'Dice Game', 'Party Game',
        'War Game', 'Miniatures', 'RPG', 'Other'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE play_time AS ENUM (
        '0-15 Minutes', '15-30 Minutes', '30-45 Minutes',
        '45-60 Minutes', '60+ Minutes', '2+ Hours', '3+ Hours'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE sale_condition AS ENUM (
        'New/Sealed', 'Like New', 'Very Good', 'Good', 'Acceptable'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================
-- Users Table (v2 auth)
-- =====================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =====================
-- Publishers
-- =====================

CREATE TABLE IF NOT EXISTS publishers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- Mechanics
-- =====================

CREATE TABLE IF NOT EXISTS mechanics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- Games
-- =====================

CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT,
    description TEXT,
    image_url TEXT,
    additional_images TEXT[] DEFAULT '{}',
    min_players INTEGER DEFAULT 1,
    max_players INTEGER DEFAULT 4,
    play_time play_time DEFAULT '45-60 Minutes',
    difficulty difficulty_level DEFAULT '3 - Medium',
    game_type game_type DEFAULT 'Board Game',
    suggested_age TEXT DEFAULT '10+',
    publisher_id UUID REFERENCES publishers(id),
    bgg_id TEXT,
    bgg_url TEXT,
    youtube_videos TEXT[] DEFAULT '{}',
    is_expansion BOOLEAN NOT NULL DEFAULT false,
    parent_game_id UUID REFERENCES games(id),
    is_coming_soon BOOLEAN NOT NULL DEFAULT false,
    is_for_sale BOOLEAN NOT NULL DEFAULT false,
    sale_price NUMERIC,
    sale_condition sale_condition,
    sleeved BOOLEAN DEFAULT false,
    upgraded_components BOOLEAN DEFAULT false,
    crowdfunded BOOLEAN DEFAULT false,
    in_base_game_box BOOLEAN DEFAULT false,
    inserts BOOLEAN DEFAULT false,
    location_room TEXT,
    location_shelf TEXT,
    location_misc TEXT,
    genre TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_games_slug ON games(slug);
CREATE INDEX IF NOT EXISTS idx_games_bgg_id ON games(bgg_id);

-- =====================
-- Game Mechanics (junction)
-- =====================

CREATE TABLE IF NOT EXISTS game_mechanics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    mechanic_id UUID NOT NULL REFERENCES mechanics(id) ON DELETE CASCADE,
    UNIQUE(game_id, mechanic_id)
);

-- =====================
-- Game Admin Data
-- =====================

CREATE TABLE IF NOT EXISTS game_admin_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL UNIQUE REFERENCES games(id) ON DELETE CASCADE,
    purchase_date DATE,
    purchase_price NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- Game Sessions (Play Logs)
-- =====================

CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    played_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_minutes INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_session_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    player_name TEXT NOT NULL,
    score INTEGER,
    is_winner BOOLEAN NOT NULL DEFAULT false,
    is_first_play BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- Game Wishlist
-- =====================

CREATE TABLE IF NOT EXISTS game_wishlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    guest_identifier TEXT NOT NULL,
    guest_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(game_id, guest_identifier)
);

-- =====================
-- Game Ratings
-- =====================

CREATE TABLE IF NOT EXISTS game_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    guest_identifier TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    ip_address TEXT,
    device_fingerprint TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(game_id, guest_identifier)
);

-- =====================
-- Game Messages (Contact)
-- =====================

CREATE TABLE IF NOT EXISTS game_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    sender_name_encrypted TEXT,
    sender_email_encrypted TEXT,
    message_encrypted TEXT,
    sender_ip_encrypted TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- Site Settings
-- =====================

CREATE TABLE IF NOT EXISTS site_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- User Roles (legacy compat)
-- =====================

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

-- =====================
-- Views
-- =====================

CREATE OR REPLACE VIEW game_ratings_summary AS
SELECT 
    game_id,
    ROUND(AVG(rating)::numeric, 1) as average_rating,
    COUNT(*)::integer as rating_count
FROM game_ratings
GROUP BY game_id;

CREATE OR REPLACE VIEW game_wishlist_summary AS
SELECT 
    game_id,
    COUNT(*)::bigint as vote_count,
    COUNT(guest_name)::bigint as named_votes
FROM game_wishlist
GROUP BY game_id;

-- =====================
-- Helper Functions
-- =====================

CREATE OR REPLACE FUNCTION slugify(input TEXT) 
RETURNS TEXT AS $$
BEGIN
    RETURN lower(regexp_replace(regexp_replace(input, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION generate_slug(title TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN slugify(title);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================
-- Auto-update triggers
-- =====================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    CREATE TRIGGER games_updated_at BEFORE UPDATE ON games
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER game_admin_data_updated_at BEFORE UPDATE ON game_admin_data
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER game_sessions_updated_at BEFORE UPDATE ON game_sessions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER site_settings_updated_at BEFORE UPDATE ON site_settings
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER game_ratings_updated_at BEFORE UPDATE ON game_ratings
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
