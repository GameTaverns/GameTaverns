-- GameTaverns Multi-Tenant - Core Schema
-- This schema manages the platform: users, tenants (libraries), billing
-- Each tenant's data lives in the main schema, isolated by library_id

-- =====================
-- Extensions
-- =====================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

DO $$ BEGIN
    CREATE TYPE feedback_type AS ENUM ('bug', 'feature', 'general');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE suspension_action AS ENUM ('suspended', 'unsuspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================
-- Users (Platform-level auth)
-- =====================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =====================
-- User Profiles
-- =====================

CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    display_name TEXT,
    username TEXT UNIQUE,
    avatar_url TEXT,
    bio TEXT,
    discord_user_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- User Roles
-- =====================

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

-- =====================
-- Libraries (Tenants)
-- =====================

CREATE TABLE IF NOT EXISTS libraries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(id),
    custom_domain TEXT UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_libraries_slug ON libraries(slug);
CREATE INDEX IF NOT EXISTS idx_libraries_owner ON libraries(owner_id);

-- =====================
-- Library Settings
-- =====================

CREATE TABLE IF NOT EXISTS library_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE UNIQUE,
    
    -- Feature flags
    feature_play_logs BOOLEAN DEFAULT TRUE,
    feature_wishlist BOOLEAN DEFAULT TRUE,
    feature_for_sale BOOLEAN DEFAULT TRUE,
    feature_messaging BOOLEAN DEFAULT TRUE,
    feature_ratings BOOLEAN DEFAULT TRUE,
    feature_events BOOLEAN DEFAULT TRUE,
    feature_coming_soon BOOLEAN DEFAULT TRUE,
    
    -- Branding
    logo_url TEXT,
    background_image_url TEXT,
    background_overlay_opacity TEXT DEFAULT '0.85',
    footer_text TEXT,
    
    -- Theme (Light mode)
    theme_primary_h TEXT DEFAULT '25',
    theme_primary_s TEXT DEFAULT '95%',
    theme_primary_l TEXT DEFAULT '50%',
    theme_accent_h TEXT DEFAULT '25',
    theme_accent_s TEXT DEFAULT '90%',
    theme_accent_l TEXT DEFAULT '40%',
    theme_background_h TEXT DEFAULT '40',
    theme_background_s TEXT DEFAULT '30%',
    theme_background_l TEXT DEFAULT '95%',
    theme_card_h TEXT DEFAULT '40',
    theme_card_s TEXT DEFAULT '25%',
    theme_card_l TEXT DEFAULT '92%',
    theme_sidebar_h TEXT DEFAULT '25',
    theme_sidebar_s TEXT DEFAULT '30%',
    theme_sidebar_l TEXT DEFAULT '20%',
    
    -- Theme (Dark mode)
    theme_dark_primary_h TEXT DEFAULT '25',
    theme_dark_primary_s TEXT DEFAULT '95%',
    theme_dark_primary_l TEXT DEFAULT '60%',
    theme_dark_accent_h TEXT DEFAULT '25',
    theme_dark_accent_s TEXT DEFAULT '90%',
    theme_dark_accent_l TEXT DEFAULT '50%',
    theme_dark_background_h TEXT DEFAULT '25',
    theme_dark_background_s TEXT DEFAULT '20%',
    theme_dark_background_l TEXT DEFAULT '10%',
    theme_dark_card_h TEXT DEFAULT '25',
    theme_dark_card_s TEXT DEFAULT '15%',
    theme_dark_card_l TEXT DEFAULT '15%',
    theme_dark_sidebar_h TEXT DEFAULT '25',
    theme_dark_sidebar_s TEXT DEFAULT '20%',
    theme_dark_sidebar_l TEXT DEFAULT '8%',
    
    -- Fonts
    theme_font_display TEXT DEFAULT 'Cinzel',
    theme_font_body TEXT DEFAULT 'Lora',
    
    -- Social links
    contact_email TEXT,
    discord_url TEXT,
    discord_webhook_url TEXT,
    discord_events_channel_id TEXT,
    discord_notifications JSONB DEFAULT '{"game_added": true, "poll_created": true, "poll_closed": true, "wishlist_vote": true, "message_received": true}',
    facebook_url TEXT,
    instagram_url TEXT,
    twitter_handle TEXT,
    
    -- Security
    turnstile_site_key TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- Library Suspensions (Audit log)
-- =====================

CREATE TABLE IF NOT EXISTS library_suspensions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    library_id UUID NOT NULL REFERENCES libraries(id),
    action suspension_action NOT NULL,
    reason TEXT,
    performed_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- Publishers (Global)
-- =====================

CREATE TABLE IF NOT EXISTS publishers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- Mechanics (Global)
-- =====================

CREATE TABLE IF NOT EXISTS mechanics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- Games (Per-library)
-- =====================

CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
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
    is_expansion BOOLEAN NOT NULL DEFAULT FALSE,
    parent_game_id UUID REFERENCES games(id),
    is_coming_soon BOOLEAN NOT NULL DEFAULT FALSE,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    is_for_sale BOOLEAN NOT NULL DEFAULT FALSE,
    sale_price NUMERIC,
    sale_condition sale_condition,
    sleeved BOOLEAN DEFAULT FALSE,
    upgraded_components BOOLEAN DEFAULT FALSE,
    crowdfunded BOOLEAN DEFAULT FALSE,
    in_base_game_box BOOLEAN DEFAULT FALSE,
    inserts BOOLEAN DEFAULT FALSE,
    location_room TEXT,
    location_shelf TEXT,
    location_misc TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(library_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_games_library ON games(library_id);
CREATE INDEX IF NOT EXISTS idx_games_slug ON games(library_id, slug);
CREATE INDEX IF NOT EXISTS idx_games_bgg_id ON games(bgg_id);

-- =====================
-- Game Mechanics (Junction)
-- =====================

CREATE TABLE IF NOT EXISTS game_mechanics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    mechanic_id UUID NOT NULL REFERENCES mechanics(id) ON DELETE CASCADE,
    UNIQUE(game_id, mechanic_id)
);

-- =====================
-- Game Admin Data
-- =====================

CREATE TABLE IF NOT EXISTS game_admin_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    played_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_minutes INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_session_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    player_name TEXT NOT NULL,
    score INTEGER,
    is_winner BOOLEAN NOT NULL DEFAULT FALSE,
    is_first_play BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- Game Wishlist
-- =====================

CREATE TABLE IF NOT EXISTS game_wishlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    sender_name_encrypted TEXT,
    sender_email_encrypted TEXT,
    message_encrypted TEXT,
    sender_ip_encrypted TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- Game Polls
-- =====================

CREATE TABLE IF NOT EXISTS game_polls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    poll_type TEXT NOT NULL DEFAULT 'quick',
    status TEXT NOT NULL DEFAULT 'open',
    max_votes_per_user INTEGER DEFAULT 1,
    show_results_before_close BOOLEAN DEFAULT FALSE,
    voting_ends_at TIMESTAMPTZ,
    event_date TIMESTAMPTZ,
    event_location TEXT,
    share_token TEXT DEFAULT encode(gen_random_bytes(16), 'hex'),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poll_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    poll_id UUID NOT NULL REFERENCES game_polls(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poll_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    poll_id UUID NOT NULL REFERENCES game_polls(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    voter_identifier TEXT NOT NULL,
    voter_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(poll_id, option_id, voter_identifier)
);

CREATE TABLE IF NOT EXISTS game_night_rsvps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    poll_id UUID NOT NULL REFERENCES game_polls(id) ON DELETE CASCADE,
    guest_identifier TEXT NOT NULL,
    guest_name TEXT,
    status TEXT NOT NULL DEFAULT 'going',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(poll_id, guest_identifier)
);

-- =====================
-- Library Events
-- =====================

CREATE TABLE IF NOT EXISTS library_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    event_location TEXT,
    discord_thread_id TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- Import Jobs
-- =====================

CREATE TABLE IF NOT EXISTS import_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_items INTEGER NOT NULL DEFAULT 0,
    successful_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- Platform Feedback
-- =====================

CREATE TABLE IF NOT EXISTS platform_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_name TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    type feedback_type NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- Site Settings (Global platform)
-- =====================

CREATE TABLE IF NOT EXISTS site_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- Password Reset Tokens
-- =====================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- Email Confirmation Tokens
-- =====================

CREATE TABLE IF NOT EXISTS email_confirmation_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

CREATE OR REPLACE VIEW poll_results AS
SELECT 
    po.id as option_id,
    po.poll_id,
    po.game_id,
    g.title as game_title,
    g.image_url,
    COUNT(pv.id)::bigint as vote_count
FROM poll_options po
JOIN games g ON g.id = po.game_id
LEFT JOIN poll_votes pv ON pv.option_id = po.id
GROUP BY po.id, po.poll_id, po.game_id, g.title, g.image_url;

CREATE OR REPLACE VIEW library_calendar_events AS
SELECT 
    id,
    library_id,
    title,
    description,
    event_date,
    event_location,
    NULL as share_token,
    NULL as poll_status,
    'event' as event_type,
    created_at
FROM library_events
UNION ALL
SELECT 
    id,
    library_id,
    title,
    description,
    event_date,
    event_location,
    share_token,
    status as poll_status,
    'game_night' as event_type,
    created_at
FROM game_polls
WHERE poll_type = 'game_night' AND event_date IS NOT NULL;

-- =====================
-- Helper Functions
-- =====================

CREATE OR REPLACE FUNCTION slugify(input TEXT) 
RETURNS TEXT AS $$
BEGIN
    RETURN lower(regexp_replace(regexp_replace(COALESCE(input, ''), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION generate_slug(title TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN slugify(title);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = _user_id AND role = _role
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_library_owner(_user_id UUID, _library_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM libraries
        WHERE id = _library_id AND owner_id = _user_id
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

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

CREATE OR REPLACE FUNCTION set_game_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := slugify(NEW.title);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_library_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO library_settings (library_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (user_id, display_name)
    VALUES (NEW.id, split_part(NEW.email, '@', 1));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DO $$ BEGIN
    CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER user_profiles_updated_at BEFORE UPDATE ON user_profiles
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER libraries_updated_at BEFORE UPDATE ON libraries
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER library_settings_updated_at BEFORE UPDATE ON library_settings
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER games_updated_at BEFORE UPDATE ON games
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER games_set_slug BEFORE INSERT ON games
        FOR EACH ROW EXECUTE FUNCTION set_game_slug();
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
    CREATE TRIGGER game_ratings_updated_at BEFORE UPDATE ON game_ratings
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER game_polls_updated_at BEFORE UPDATE ON game_polls
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER library_events_updated_at BEFORE UPDATE ON library_events
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER import_jobs_updated_at BEFORE UPDATE ON import_jobs
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER site_settings_updated_at BEFORE UPDATE ON site_settings
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER libraries_create_settings AFTER INSERT ON libraries
        FOR EACH ROW EXECUTE FUNCTION create_library_settings();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER users_create_profile AFTER INSERT ON users
        FOR EACH ROW EXECUTE FUNCTION create_user_profile();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================
-- Default Data
-- =====================

-- Insert common mechanics
INSERT INTO mechanics (name) VALUES
    ('Deck Building'),
    ('Worker Placement'),
    ('Area Control'),
    ('Dice Rolling'),
    ('Hand Management'),
    ('Set Collection'),
    ('Tile Placement'),
    ('Drafting'),
    ('Cooperative'),
    ('Engine Building'),
    ('Resource Management'),
    ('Action Selection'),
    ('Negotiation'),
    ('Auction/Bidding'),
    ('Route Building')
ON CONFLICT DO NOTHING;
