-- ═══════════════════════════════════════════════════════════════════════════
-- GameTaverns Database Schema
-- PostgreSQL 16+
-- 
-- This schema creates all tables, types, functions, triggers, and views
-- for a complete multi-tenant board game library platform.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- EXTENSIONS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ═══════════════════════════════════════════════════════════════════════════
-- CUSTOM TYPES (ENUMS)
-- ═══════════════════════════════════════════════════════════════════════════

-- Application roles
CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');

-- Game difficulty levels
CREATE TYPE difficulty_level AS ENUM (
    '1 - Light',
    '2 - Medium Light',
    '3 - Medium',
    '4 - Medium Heavy',
    '5 - Heavy'
);

-- Play time categories
CREATE TYPE play_time AS ENUM (
    '0-15 Minutes',
    '15-30 Minutes',
    '30-45 Minutes',
    '45-60 Minutes',
    '60+ Minutes',
    '2+ Hours',
    '3+ Hours'
);

-- Game types
CREATE TYPE game_type AS ENUM (
    'Board Game',
    'Card Game',
    'Dice Game',
    'Party Game',
    'War Game',
    'Miniatures',
    'RPG',
    'Other'
);

-- Sale condition
CREATE TYPE sale_condition AS ENUM (
    'New in Shrink',
    'Like New',
    'Very Good',
    'Good',
    'Acceptable'
);

-- Feedback types
CREATE TYPE feedback_type AS ENUM (
    'bug',
    'feature',
    'feedback',
    'other'
);

-- Suspension actions
CREATE TYPE suspension_action AS ENUM (
    'suspended',
    'restored'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- UTILITY FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- Generate URL-friendly slugs
CREATE OR REPLACE FUNCTION slugify(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT trim(both '-' from regexp_replace(
        regexp_replace(lower(unaccent(coalesce(input, ''))), '[^a-z0-9]+', '-', 'g'),
        '-{2,}', '-', 'g'
    ));
$$;

-- Generate slug from title
CREATE OR REPLACE FUNCTION generate_slug(title text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    slug TEXT;
BEGIN
    slug := lower(title);
    slug := regexp_replace(slug, '[^a-z0-9\s-]', '', 'g');
    slug := regexp_replace(slug, '\s+', '-', 'g');
    slug := regexp_replace(slug, '-+', '-', 'g');
    slug := trim(both '-' from slug);
    RETURN slug;
END;
$$;

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Check if slug is available
CREATE OR REPLACE FUNCTION is_slug_available(check_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT NOT EXISTS (
        SELECT 1 FROM libraries WHERE slug = lower(check_slug)
    );
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- CORE TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- Users table (authentication)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);

-- User profiles (public information)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT,
    username TEXT UNIQUE,
    avatar_url TEXT,
    bio TEXT,
    discord_user_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_username ON user_profiles(username);

-- User roles (authorization)
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- TOKEN TABLES (Authentication)
-- ═══════════════════════════════════════════════════════════════════════════

-- Email confirmation tokens
CREATE TABLE email_confirmation_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_tokens_token ON email_confirmation_tokens(token);
CREATE INDEX idx_email_tokens_user_id ON email_confirmation_tokens(user_id);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reset_tokens_token ON password_reset_tokens(token);

-- ═══════════════════════════════════════════════════════════════════════════
-- MULTI-TENANT TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- Libraries (tenants)
CREATE TABLE libraries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    custom_domain TEXT UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_premium BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_libraries_slug ON libraries(slug);
CREATE INDEX idx_libraries_owner_id ON libraries(owner_id);
CREATE INDEX idx_libraries_custom_domain ON libraries(custom_domain);

-- Library settings
CREATE TABLE library_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL UNIQUE REFERENCES libraries(id) ON DELETE CASCADE,
    
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
    twitter_handle TEXT,
    instagram_url TEXT,
    facebook_url TEXT,
    
    -- Discord integration (hidden from public)
    discord_webhook_url TEXT,
    discord_events_channel_id TEXT,
    discord_notifications JSONB DEFAULT '{"game_added": true, "poll_closed": true, "poll_created": true, "wishlist_vote": true, "message_received": true}',
    
    -- Security
    turnstile_site_key TEXT,
    
    -- Features
    feature_play_logs BOOLEAN DEFAULT true,
    feature_wishlist BOOLEAN DEFAULT true,
    feature_for_sale BOOLEAN DEFAULT true,
    feature_messaging BOOLEAN DEFAULT true,
    feature_ratings BOOLEAN DEFAULT true,
    feature_coming_soon BOOLEAN DEFAULT true,
    feature_events BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Library suspensions (audit log)
CREATE TABLE library_suspensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    performed_by UUID NOT NULL REFERENCES users(id),
    action suspension_action NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- GAME TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- Publishers
CREATE TABLE publishers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Mechanics
CREATE TABLE mechanics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Games
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID REFERENCES libraries(id) ON DELETE CASCADE,
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
    
    -- Relationships
    publisher_id UUID REFERENCES publishers(id),
    is_expansion BOOLEAN NOT NULL DEFAULT false,
    parent_game_id UUID REFERENCES games(id) ON DELETE SET NULL,
    
    -- Status flags
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    is_coming_soon BOOLEAN NOT NULL DEFAULT false,
    is_for_sale BOOLEAN NOT NULL DEFAULT false,
    sale_price NUMERIC,
    sale_condition sale_condition,
    
    -- Storage location
    location_room TEXT,
    location_shelf TEXT,
    location_misc TEXT,
    
    -- Component status
    sleeved BOOLEAN DEFAULT false,
    upgraded_components BOOLEAN DEFAULT false,
    inserts BOOLEAN DEFAULT false,
    in_base_game_box BOOLEAN DEFAULT false,
    crowdfunded BOOLEAN DEFAULT false,
    
    -- External references
    bgg_id TEXT,
    bgg_url TEXT,
    youtube_videos TEXT[] DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_games_library_id ON games(library_id);
CREATE INDEX idx_games_slug ON games(slug);
CREATE INDEX idx_games_bgg_id ON games(bgg_id);
CREATE UNIQUE INDEX idx_games_library_slug ON games(library_id, slug);

-- Game mechanics junction
CREATE TABLE game_mechanics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    mechanic_id UUID NOT NULL REFERENCES mechanics(id) ON DELETE CASCADE,
    UNIQUE(game_id, mechanic_id)
);

-- Game admin data (hidden from public)
CREATE TABLE game_admin_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL UNIQUE REFERENCES games(id) ON DELETE CASCADE,
    purchase_price NUMERIC,
    purchase_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- USER INTERACTION TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- Game ratings (guest-accessible)
CREATE TABLE game_ratings (
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

CREATE INDEX idx_game_ratings_game_id ON game_ratings(game_id);

-- Game wishlist (guest-accessible)
CREATE TABLE game_wishlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    guest_identifier TEXT NOT NULL,
    guest_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(game_id, guest_identifier)
);

CREATE INDEX idx_game_wishlist_game_id ON game_wishlist(game_id);

-- Game messages (encrypted PII)
CREATE TABLE game_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    sender_name_encrypted TEXT,
    sender_email_encrypted TEXT,
    sender_ip_encrypted TEXT,
    message_encrypted TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_game_messages_game_id ON game_messages(game_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- PLAY LOGGING TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- Game sessions
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    played_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_minutes INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_game_sessions_game_id ON game_sessions(game_id);

-- Session players
CREATE TABLE game_session_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    player_name TEXT NOT NULL,
    score INTEGER,
    is_winner BOOLEAN NOT NULL DEFAULT false,
    is_first_play BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_players_session_id ON game_session_players(session_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- EVENTS & POLLS
-- ═══════════════════════════════════════════════════════════════════════════

-- Library events
CREATE TABLE library_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    event_location TEXT,
    discord_thread_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_library_events_library_id ON library_events(library_id);
CREATE INDEX idx_library_events_date ON library_events(event_date);

-- Game polls
CREATE TABLE game_polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT,
    poll_type TEXT NOT NULL DEFAULT 'quick',
    status TEXT NOT NULL DEFAULT 'open',
    voting_ends_at TIMESTAMPTZ,
    max_votes_per_user INTEGER DEFAULT 1,
    show_results_before_close BOOLEAN DEFAULT false,
    event_date TIMESTAMPTZ,
    event_location TEXT,
    share_token TEXT DEFAULT encode(gen_random_bytes(16), 'hex'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_game_polls_library_id ON game_polls(library_id);
CREATE INDEX idx_game_polls_share_token ON game_polls(share_token);

-- Poll options
CREATE TABLE poll_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES game_polls(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_poll_options_poll_id ON poll_options(poll_id);

-- Poll votes
CREATE TABLE poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES game_polls(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    voter_identifier TEXT NOT NULL,
    voter_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(poll_id, option_id, voter_identifier)
);

CREATE INDEX idx_poll_votes_poll_id ON poll_votes(poll_id);

-- Game night RSVPs
CREATE TABLE game_night_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES game_polls(id) ON DELETE CASCADE,
    guest_identifier TEXT NOT NULL,
    guest_name TEXT,
    status TEXT NOT NULL DEFAULT 'going',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(poll_id, guest_identifier)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- PLATFORM TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- Platform feedback
CREATE TABLE platform_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_name TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    type feedback_type NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Site settings
CREATE TABLE site_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Import jobs (for bulk imports)
CREATE TABLE import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════

-- Auto-update timestamps
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_libraries_updated_at BEFORE UPDATE ON libraries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_library_settings_updated_at BEFORE UPDATE ON library_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_admin_data_updated_at BEFORE UPDATE ON game_admin_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_ratings_updated_at BEFORE UPDATE ON game_ratings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_sessions_updated_at BEFORE UPDATE ON game_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_polls_updated_at BEFORE UPDATE ON game_polls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_night_rsvps_updated_at BEFORE UPDATE ON game_night_rsvps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_import_jobs_updated_at BEFORE UPDATE ON import_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON site_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-generate game slugs
CREATE OR REPLACE FUNCTION games_set_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
        NEW.slug := slugify(NEW.title);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_game_slug BEFORE INSERT OR UPDATE ON games
    FOR EACH ROW EXECUTE FUNCTION games_set_slug();

-- Auto-create library settings
CREATE OR REPLACE FUNCTION create_library_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO library_settings (library_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER create_library_settings_trigger AFTER INSERT ON libraries
    FOR EACH ROW EXECUTE FUNCTION create_library_settings();

-- Auto-create user profile
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO user_profiles (user_id, display_name)
    VALUES (NEW.id, split_part(NEW.email, '@', 1));
    RETURN NEW;
END;
$$;

CREATE TRIGGER create_user_profile_trigger AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- ═══════════════════════════════════════════════════════════════════════════
-- VIEWS (for public access without sensitive data)
-- ═══════════════════════════════════════════════════════════════════════════

-- Public library view (hides owner_id)
CREATE OR REPLACE VIEW libraries_public WITH (security_invoker = true) AS
SELECT 
    id, name, slug, description, custom_domain,
    is_active, is_premium, created_at, updated_at
FROM libraries
WHERE is_active = true;

-- Public games view (hides is_favorite for non-owners)
CREATE OR REPLACE VIEW games_public WITH (security_invoker = true) AS
SELECT 
    id, library_id, title, slug, description, image_url, additional_images,
    min_players, max_players, play_time, difficulty, game_type, suggested_age,
    publisher_id, is_expansion, parent_game_id,
    is_coming_soon, is_for_sale, sale_price, sale_condition,
    location_room, location_shelf, location_misc,
    sleeved, upgraded_components, inserts, in_base_game_box, crowdfunded,
    bgg_id, bgg_url, youtube_videos,
    created_at, updated_at
FROM games;

-- Public library settings (hides sensitive fields)
CREATE OR REPLACE VIEW library_settings_public WITH (security_invoker = true) AS
SELECT 
    id, library_id, logo_url, background_image_url, background_overlay_opacity,
    footer_text,
    theme_primary_h, theme_primary_s, theme_primary_l,
    theme_accent_h, theme_accent_s, theme_accent_l,
    theme_background_h, theme_background_s, theme_background_l,
    theme_card_h, theme_card_s, theme_card_l,
    theme_sidebar_h, theme_sidebar_s, theme_sidebar_l,
    theme_dark_primary_h, theme_dark_primary_s, theme_dark_primary_l,
    theme_dark_accent_h, theme_dark_accent_s, theme_dark_accent_l,
    theme_dark_background_h, theme_dark_background_s, theme_dark_background_l,
    theme_dark_card_h, theme_dark_card_s, theme_dark_card_l,
    theme_dark_sidebar_h, theme_dark_sidebar_s, theme_dark_sidebar_l,
    theme_font_display, theme_font_body,
    contact_email, discord_url, twitter_handle, instagram_url, facebook_url,
    feature_play_logs, feature_wishlist, feature_for_sale, feature_messaging,
    feature_ratings, feature_coming_soon, feature_events,
    created_at, updated_at
FROM library_settings;

-- Public user profiles (hides user_id, discord_user_id)
CREATE OR REPLACE VIEW user_profiles_public WITH (security_invoker = true) AS
SELECT 
    id, display_name, username, avatar_url, bio,
    created_at, updated_at
FROM user_profiles;

-- Game ratings view for library owners (hides IP/fingerprint)
CREATE OR REPLACE VIEW game_ratings_library_view WITH (security_invoker = true) AS
SELECT 
    id, game_id, guest_identifier, rating,
    created_at, updated_at
FROM game_ratings;

-- Game ratings summary
CREATE OR REPLACE VIEW game_ratings_summary AS
SELECT 
    game_id,
    COUNT(*)::integer AS rating_count,
    ROUND(AVG(rating)::numeric, 2) AS average_rating
FROM game_ratings
GROUP BY game_id;

-- Site settings public view (for announcement banner)
CREATE OR REPLACE VIEW site_settings_public AS
SELECT id, key, value, created_at, updated_at
FROM site_settings
WHERE key IN ('announcement', 'announcement_active', 'maintenance_mode', 'signup_enabled');

-- Game wishlist summary
CREATE OR REPLACE VIEW game_wishlist_summary AS
SELECT 
    game_id,
    COUNT(*)::bigint AS vote_count,
    COUNT(guest_name)::bigint AS named_votes
FROM game_wishlist
GROUP BY game_id;

-- Poll results view
CREATE OR REPLACE VIEW poll_results AS
SELECT 
    po.id AS option_id,
    po.poll_id,
    po.game_id,
    g.title AS game_title,
    g.image_url,
    COUNT(pv.id)::bigint AS vote_count
FROM poll_options po
JOIN games g ON g.id = po.game_id
LEFT JOIN poll_votes pv ON pv.option_id = po.id
GROUP BY po.id, po.poll_id, po.game_id, g.title, g.image_url;

-- Library calendar events (combines events and game nights)
CREATE OR REPLACE VIEW library_calendar_events AS
SELECT 
    le.id,
    le.library_id,
    le.title,
    le.description,
    le.event_date,
    le.event_location,
    'event' AS event_type,
    NULL AS poll_status,
    NULL AS share_token,
    le.created_at
FROM library_events le
UNION ALL
SELECT 
    gp.id,
    gp.library_id,
    gp.title,
    gp.description,
    gp.event_date,
    gp.event_location,
    'game_night' AS event_type,
    gp.status AS poll_status,
    gp.share_token,
    gp.created_at
FROM game_polls gp
WHERE gp.event_date IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- TOKEN CLEANUP FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM password_reset_tokens
    WHERE expires_at < now() - interval '24 hours';
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_expired_email_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM email_confirmation_tokens
    WHERE expires_at < now() - interval '24 hours';
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PERFORMANCE INDEXES
-- ═══════════════════════════════════════════════════════════════════════════

-- Composite indexes for common queries
CREATE INDEX idx_games_library_is_for_sale ON games(library_id, is_for_sale) WHERE is_for_sale = true;
CREATE INDEX idx_games_library_is_coming_soon ON games(library_id, is_coming_soon) WHERE is_coming_soon = true;
CREATE INDEX idx_games_library_is_expansion ON games(library_id, is_expansion);
CREATE INDEX idx_games_parent_game_id ON games(parent_game_id) WHERE parent_game_id IS NOT NULL;

-- Full text search indexes (if needed)
CREATE INDEX idx_games_title_trgm ON games USING gin (title gin_trgm_ops);
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Date-based query optimization
CREATE INDEX idx_library_events_future ON library_events(library_id, event_date) WHERE event_date > now();
CREATE INDEX idx_game_polls_active ON game_polls(library_id, status) WHERE status = 'open';
CREATE INDEX idx_game_sessions_recent ON game_sessions(game_id, played_at DESC);

-- Token expiry indexes for cleanup
CREATE INDEX idx_email_tokens_expires ON email_confirmation_tokens(expires_at);
CREATE INDEX idx_reset_tokens_expires ON password_reset_tokens(expires_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETE
-- ═══════════════════════════════════════════════════════════════════════════

-- Log successful migration
INSERT INTO site_settings (key, value) VALUES 
    ('schema_version', '1.0.0'),
    ('installed_at', now()::text)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
