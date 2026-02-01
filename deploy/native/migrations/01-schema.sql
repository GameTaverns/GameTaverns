-- ═══════════════════════════════════════════════════════════════════════════
-- GameTaverns Database Schema v2.1.0
-- PostgreSQL 16+
-- 
-- This schema creates all tables, types, functions, triggers, and views
-- for a complete multi-tenant board game library platform.
--
-- IMPORTANT: Run this on a fresh database. Uses IF NOT EXISTS for idempotency.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- EXTENSIONS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ═══════════════════════════════════════════════════════════════════════════
-- CUSTOM TYPES (ENUMS)
-- ═══════════════════════════════════════════════════════════════════════════

-- App roles (Platform-level roles)
-- T1: admin    - Site super-administrators with full access
-- T2: staff    - Site staff with elevated privileges
-- T3: owner    - Library/community owners (explicit assignment for dashboard access)
-- T4: moderator - (DEPRECATED at platform level, use library_member_role instead)
-- T5: (no role) - Regular users
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('admin', 'staff', 'owner', 'moderator');
EXCEPTION WHEN duplicate_object THEN 
    -- Enum exists, add new values if missing
    BEGIN ALTER TYPE app_role ADD VALUE 'staff'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE app_role ADD VALUE 'owner'; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

DO $$ BEGIN
    CREATE TYPE difficulty_level AS ENUM (
        '1 - Very Easy',
        '2 - Easy',
        '3 - Medium',
        '4 - Hard',
        '5 - Very Hard'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE play_time AS ENUM (
        'Under 30 Minutes',
        '30-45 Minutes',
        '45-60 Minutes',
        '60-90 Minutes',
        '90-120 Minutes',
        '2-3 Hours',
        '3+ Hours'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE game_type AS ENUM (
        'Board Game',
        'Card Game',
        'Dice Game',
        'Party Game',
        'Strategy Game',
        'Cooperative Game',
        'Miniatures Game',
        'Role-Playing Game',
        'Deck Building',
        'Area Control',
        'Worker Placement',
        'Other'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE sale_condition AS ENUM (
        'New',
        'Like New',
        'Very Good',
        'Good',
        'Acceptable'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE feedback_type AS ENUM (
        'bug',
        'feature',
        'general'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE suspension_action AS ENUM (
        'suspended',
        'reinstated'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE library_member_role AS ENUM (
        'member',
        'moderator'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE achievement_category AS ENUM (
        'collection',
        'social',
        'engagement',
        'special'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE loan_status AS ENUM (
        'requested',
        'approved', 
        'borrowed',
        'returned',
        'cancelled',
        'declined'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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

-- Generate slug from title (alias)
CREATE OR REPLACE FUNCTION generate_slug(title text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    result_slug TEXT;
BEGIN
    result_slug := lower(title);
    result_slug := regexp_replace(result_slug, '[^a-z0-9\s-]', '', 'g');
    result_slug := regexp_replace(result_slug, '\s+', '-', 'g');
    result_slug := regexp_replace(result_slug, '-+', '-', 'g');
    result_slug := trim(both '-' from result_slug);
    RETURN result_slug;
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

-- ═══════════════════════════════════════════════════════════════════════════
-- CORE TABLES (must be created first for FK references)
-- ═══════════════════════════════════════════════════════════════════════════

-- Users table (authentication)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- User profiles (public information)
CREATE TABLE IF NOT EXISTS user_profiles (
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

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);

-- User roles (authorization) - CRITICAL: separate from profiles for security
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

-- Security definer function for role checking (prevents privilege escalation)
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

-- Get the tier number for a role (lower = more privileged)
CREATE OR REPLACE FUNCTION get_role_tier(_role app_role)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _role
    WHEN 'admin' THEN 1
    WHEN 'staff' THEN 2
    WHEN 'owner' THEN 3
    WHEN 'moderator' THEN 4
    ELSE 5
  END;
$$;

-- Check if user has at least a certain role level (hierarchical check)
CREATE OR REPLACE FUNCTION has_role_level(_user_id uuid, _min_role app_role)
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
      AND get_role_tier(role) <= get_role_tier(_min_role)
  )
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TOKEN TABLES (Authentication)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS email_confirmation_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_tokens_token ON email_confirmation_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_tokens_user_id ON email_confirmation_tokens(user_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON password_reset_tokens(token);

-- ═══════════════════════════════════════════════════════════════════════════
-- MULTI-TENANT TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- Libraries (tenants)
-- NOTE: owner_id is hidden from public via libraries_public view and API layer
CREATE TABLE IF NOT EXISTS libraries (
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

CREATE INDEX IF NOT EXISTS idx_libraries_slug ON libraries(slug);
CREATE INDEX IF NOT EXISTS idx_libraries_owner_id ON libraries(owner_id);
CREATE INDEX IF NOT EXISTS idx_libraries_custom_domain ON libraries(custom_domain);

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

-- Library settings
CREATE TABLE IF NOT EXISTS library_settings (
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
    
    -- Discord integration (hidden from public views)
    discord_webhook_url TEXT,
    discord_events_channel_id TEXT,
    discord_notifications JSONB DEFAULT '{"game_added": true, "poll_closed": true, "poll_created": true, "wishlist_vote": true, "message_received": true}',
    
    -- Security
    turnstile_site_key TEXT,
    
    -- Community & Lending features
    allow_lending BOOLEAN NOT NULL DEFAULT false,
    is_discoverable BOOLEAN NOT NULL DEFAULT true,
    lending_terms TEXT,
    
    -- Feature flags
    feature_play_logs BOOLEAN DEFAULT true,
    feature_wishlist BOOLEAN DEFAULT true,
    feature_for_sale BOOLEAN DEFAULT true,
    feature_messaging BOOLEAN DEFAULT true,
    feature_ratings BOOLEAN DEFAULT true,
    feature_coming_soon BOOLEAN DEFAULT true,
    feature_events BOOLEAN DEFAULT true,
    feature_lending BOOLEAN DEFAULT true,
    feature_achievements BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Library suspensions (audit log)
CREATE TABLE IF NOT EXISTS library_suspensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    performed_by UUID NOT NULL REFERENCES users(id),
    action suspension_action NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Library members (community membership)
CREATE TABLE IF NOT EXISTS library_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role library_member_role NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(library_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_library_members_library_id ON library_members(library_id);
CREATE INDEX IF NOT EXISTS idx_library_members_user_id ON library_members(user_id);

-- Library followers
CREATE TABLE IF NOT EXISTS library_followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    follower_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(library_id, follower_user_id)
);

CREATE INDEX IF NOT EXISTS idx_library_followers_library_id ON library_followers(library_id);

-- Helper function: check if user is a library member or owner
CREATE OR REPLACE FUNCTION is_library_member(_user_id uuid, _library_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM library_members
        WHERE user_id = _user_id AND library_id = _library_id
    ) OR EXISTS (
        SELECT 1 FROM libraries
        WHERE id = _library_id AND owner_id = _user_id
    )
$$;

-- Helper function: check if user is a library moderator or owner
CREATE OR REPLACE FUNCTION is_library_moderator(_user_id uuid, _library_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM library_members
        WHERE user_id = _user_id 
        AND library_id = _library_id 
        AND role = 'moderator'
    ) OR EXISTS (
        SELECT 1 FROM libraries
        WHERE id = _library_id AND owner_id = _user_id
    ) OR has_role(_user_id, 'admin')
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- REFERENCE TABLES (must exist before games)
-- ═══════════════════════════════════════════════════════════════════════════

-- Publishers
CREATE TABLE IF NOT EXISTS publishers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Mechanics
CREATE TABLE IF NOT EXISTS mechanics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- GAME TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- Games (must be created before game_loans due to FK)
CREATE TABLE IF NOT EXISTS games (
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
    
    -- Theme/Genre
    genre TEXT,
    
    -- Component status
    sleeved BOOLEAN DEFAULT false,
    upgraded_components BOOLEAN DEFAULT false,
    inserts BOOLEAN DEFAULT false,
    in_base_game_box BOOLEAN DEFAULT false,
    crowdfunded BOOLEAN DEFAULT false,
    
    -- External references
    bgg_id TEXT,
    bgg_url TEXT,
    youtube_videos TEXT[] DEFAULT '{}'::text[],
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_games_library_id ON games(library_id);
CREATE INDEX IF NOT EXISTS idx_games_slug ON games(slug);
CREATE INDEX IF NOT EXISTS idx_games_bgg_id ON games(bgg_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_games_library_slug ON games(library_id, slug);

-- Game mechanics junction
CREATE TABLE IF NOT EXISTS game_mechanics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    mechanic_id UUID NOT NULL REFERENCES mechanics(id) ON DELETE CASCADE,
    UNIQUE(game_id, mechanic_id)
);

-- Game admin data (hidden from public)
CREATE TABLE IF NOT EXISTS game_admin_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL UNIQUE REFERENCES games(id) ON DELETE CASCADE,
    purchase_price NUMERIC,
    purchase_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- LENDING SYSTEM TABLES (depends on games)
-- ═══════════════════════════════════════════════════════════════════════════

-- Game loans
CREATE TABLE IF NOT EXISTS game_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    borrower_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status loan_status NOT NULL DEFAULT 'requested',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ,
    borrowed_at TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    borrower_notes TEXT,
    lender_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_loans_game_id ON game_loans(game_id);
CREATE INDEX IF NOT EXISTS idx_game_loans_library_id ON game_loans(library_id);
CREATE INDEX IF NOT EXISTS idx_game_loans_borrower ON game_loans(borrower_user_id);
CREATE INDEX IF NOT EXISTS idx_game_loans_lender ON game_loans(lender_user_id);
CREATE INDEX IF NOT EXISTS idx_game_loans_status ON game_loans(status);

-- Borrower ratings (after loan is returned)
CREATE TABLE IF NOT EXISTS borrower_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL UNIQUE REFERENCES game_loans(id) ON DELETE CASCADE,
    rated_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rated_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_borrower_ratings_rated_user ON borrower_ratings(rated_user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- ACHIEVEMENTS TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- Achievements definitions
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category achievement_category NOT NULL,
    icon TEXT,
    tier INTEGER NOT NULL DEFAULT 1,
    points INTEGER NOT NULL DEFAULT 10,
    requirement_type TEXT NOT NULL,
    requirement_value INTEGER NOT NULL,
    is_secret BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User achievements (earned achievements)
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    library_id UUID REFERENCES libraries(id) ON DELETE CASCADE,
    progress INTEGER NOT NULL DEFAULT 0,
    earned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, achievement_id, library_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- NOTIFICATIONS TABLES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    -- Email notifications
    email_loan_requests BOOLEAN NOT NULL DEFAULT true,
    email_loan_updates BOOLEAN NOT NULL DEFAULT true,
    email_event_reminders BOOLEAN NOT NULL DEFAULT true,
    email_wishlist_alerts BOOLEAN NOT NULL DEFAULT true,
    email_achievement_earned BOOLEAN NOT NULL DEFAULT true,
    -- Push notifications
    push_loan_requests BOOLEAN NOT NULL DEFAULT true,
    push_loan_updates BOOLEAN NOT NULL DEFAULT true,
    push_event_reminders BOOLEAN NOT NULL DEFAULT true,
    push_wishlist_alerts BOOLEAN NOT NULL DEFAULT true,
    push_achievement_earned BOOLEAN NOT NULL DEFAULT true,
    -- Discord notifications
    discord_loan_requests BOOLEAN NOT NULL DEFAULT true,
    discord_loan_updates BOOLEAN NOT NULL DEFAULT true,
    discord_event_reminders BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    channel TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    metadata JSONB,
    read_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_user_id ON notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_read ON notification_log(user_id, read_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- USER INTERACTION TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- Game ratings (guest-accessible)
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

CREATE INDEX IF NOT EXISTS idx_game_ratings_game_id ON game_ratings(game_id);

-- Game wishlist (guest-accessible)
CREATE TABLE IF NOT EXISTS game_wishlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    guest_identifier TEXT NOT NULL,
    guest_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(game_id, guest_identifier)
);

CREATE INDEX IF NOT EXISTS idx_game_wishlist_game_id ON game_wishlist(game_id);

-- Game messages (encrypted PII)
CREATE TABLE IF NOT EXISTS game_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    sender_name_encrypted TEXT,
    sender_email_encrypted TEXT,
    sender_ip_encrypted TEXT,
    message_encrypted TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_messages_game_id ON game_messages(game_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- PLAY LOGGING TABLES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    played_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_minutes INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_game_id ON game_sessions(game_id);

CREATE TABLE IF NOT EXISTS game_session_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    player_name TEXT NOT NULL,
    score INTEGER,
    is_winner BOOLEAN NOT NULL DEFAULT false,
    is_first_play BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_players_session_id ON game_session_players(session_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- EVENTS & POLLS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS library_events (
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

CREATE INDEX IF NOT EXISTS idx_library_events_library_id ON library_events(library_id);
CREATE INDEX IF NOT EXISTS idx_library_events_date ON library_events(event_date);

CREATE TABLE IF NOT EXISTS game_polls (
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

CREATE INDEX IF NOT EXISTS idx_game_polls_library_id ON game_polls(library_id);
CREATE INDEX IF NOT EXISTS idx_game_polls_share_token ON game_polls(share_token);

CREATE TABLE IF NOT EXISTS poll_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES game_polls(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON poll_options(poll_id);

CREATE TABLE IF NOT EXISTS poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES game_polls(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    voter_identifier TEXT NOT NULL,
    voter_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(poll_id, option_id, voter_identifier)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON poll_votes(poll_id);

CREATE TABLE IF NOT EXISTS game_night_rsvps (
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

CREATE TABLE IF NOT EXISTS platform_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_name TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    type feedback_type NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_jobs (
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

-- Drop existing triggers if they exist (for idempotency)
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
DROP TRIGGER IF EXISTS update_libraries_updated_at ON libraries;
DROP TRIGGER IF EXISTS update_library_settings_updated_at ON library_settings;
DROP TRIGGER IF EXISTS update_library_events_updated_at ON library_events;
DROP TRIGGER IF EXISTS update_games_updated_at ON games;
DROP TRIGGER IF EXISTS update_game_admin_data_updated_at ON game_admin_data;
DROP TRIGGER IF EXISTS update_game_ratings_updated_at ON game_ratings;
DROP TRIGGER IF EXISTS update_game_sessions_updated_at ON game_sessions;
DROP TRIGGER IF EXISTS update_game_polls_updated_at ON game_polls;
DROP TRIGGER IF EXISTS update_game_night_rsvps_updated_at ON game_night_rsvps;
DROP TRIGGER IF EXISTS update_import_jobs_updated_at ON import_jobs;
DROP TRIGGER IF EXISTS update_site_settings_updated_at ON site_settings;
DROP TRIGGER IF EXISTS update_game_loans_updated_at ON game_loans;
DROP TRIGGER IF EXISTS update_user_achievements_updated_at ON user_achievements;
DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
DROP TRIGGER IF EXISTS set_game_slug ON games;
DROP TRIGGER IF EXISTS create_library_settings_trigger ON libraries;
DROP TRIGGER IF EXISTS create_user_profile_trigger ON users;

-- Auto-update timestamps
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_libraries_updated_at BEFORE UPDATE ON libraries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_library_settings_updated_at BEFORE UPDATE ON library_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_library_events_updated_at BEFORE UPDATE ON library_events
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

CREATE TRIGGER update_game_loans_updated_at BEFORE UPDATE ON game_loans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_achievements_updated_at BEFORE UPDATE ON user_achievements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences
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
    VALUES (NEW.id)
    ON CONFLICT (library_id) DO NOTHING;
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
    VALUES (NEW.id, split_part(NEW.email, '@', 1))
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER create_user_profile_trigger AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- ═══════════════════════════════════════════════════════════════════════════
-- VIEWS (for public access without sensitive data)
-- ═══════════════════════════════════════════════════════════════════════════

-- Public library view (HIDES owner_id for security)
CREATE OR REPLACE VIEW libraries_public AS
SELECT 
    id, name, slug, description, custom_domain,
    is_active, is_premium, created_at, updated_at
FROM libraries
WHERE is_active = true;

-- Public games view (includes is_favorite for owners, exposed via API layer control)
CREATE OR REPLACE VIEW games_public AS
SELECT 
    id, library_id, title, slug, description, image_url, additional_images,
    min_players, max_players, play_time, difficulty, game_type, suggested_age,
    publisher_id, is_expansion, parent_game_id,
    is_coming_soon, is_for_sale, sale_price, sale_condition,
    location_room, location_shelf, location_misc,
    genre,
    sleeved, upgraded_components, inserts, in_base_game_box, crowdfunded,
    bgg_id, bgg_url, youtube_videos,
    is_favorite,
    created_at, updated_at
FROM games;

-- Public library settings (hides sensitive Discord webhook, Turnstile keys)
CREATE OR REPLACE VIEW library_settings_public AS
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
    feature_lending, feature_achievements, allow_lending, is_discoverable,
    created_at, updated_at
FROM library_settings;

-- Public user profiles (hides user_id, discord_user_id)
CREATE OR REPLACE VIEW user_profiles_public AS
SELECT 
    id, display_name, username, avatar_url, bio,
    created_at, updated_at
FROM user_profiles;

-- Game ratings view for library owners (hides IP/fingerprint for privacy)
CREATE OR REPLACE VIEW game_ratings_library_view AS
SELECT 
    id, game_id, guest_identifier, rating,
    created_at, updated_at
FROM game_ratings;

-- Game ratings summary (aggregate only)
CREATE OR REPLACE VIEW game_ratings_summary AS
SELECT 
    game_id,
    COUNT(*)::integer AS rating_count,
    ROUND(AVG(rating)::numeric, 2) AS average_rating
FROM game_ratings
GROUP BY game_id;

-- Site settings public view (for announcement banner, maintenance mode)
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

-- Library directory (discoverable libraries with stats)
CREATE OR REPLACE VIEW library_directory AS
SELECT 
    l.id,
    l.name,
    l.slug,
    l.description,
    l.created_at,
    ls.logo_url,
    ls.is_discoverable,
    ls.allow_lending,
    (SELECT COUNT(*) FROM games g WHERE g.library_id = l.id)::bigint AS game_count,
    (SELECT COUNT(*) FROM library_members lm WHERE lm.library_id = l.id)::bigint AS member_count,
    (SELECT COUNT(*) FROM library_followers lf WHERE lf.library_id = l.id)::bigint AS follower_count
FROM libraries l
LEFT JOIN library_settings ls ON ls.library_id = l.id
WHERE l.is_active = true AND COALESCE(ls.is_discoverable, true) = true;

-- Library members public view (count only, no user IDs)
CREATE OR REPLACE VIEW library_members_public AS
SELECT 
    library_id,
    COUNT(*)::bigint AS member_count
FROM library_members
GROUP BY library_id;

-- Borrower reputation view
CREATE OR REPLACE VIEW borrower_reputation AS
SELECT 
    rated_user_id AS user_id,
    ROUND(AVG(rating)::numeric, 2) AS average_rating,
    COUNT(*) AS total_ratings,
    COUNT(*) FILTER (WHERE rating >= 4) AS positive_ratings
FROM borrower_ratings
GROUP BY rated_user_id;

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
CREATE INDEX IF NOT EXISTS idx_games_library_is_for_sale ON games(library_id, is_for_sale) WHERE is_for_sale = true;
CREATE INDEX IF NOT EXISTS idx_games_library_is_coming_soon ON games(library_id, is_coming_soon) WHERE is_coming_soon = true;
CREATE INDEX IF NOT EXISTS idx_games_library_is_expansion ON games(library_id, is_expansion);
CREATE INDEX IF NOT EXISTS idx_games_parent_game_id ON games(parent_game_id) WHERE parent_game_id IS NOT NULL;

-- Full text search indexes (pg_trgm)
CREATE INDEX IF NOT EXISTS idx_games_title_trgm ON games USING gin (title gin_trgm_ops);

-- Date-based query optimization
CREATE INDEX IF NOT EXISTS idx_library_events_future ON library_events(library_id, event_date) WHERE event_date > now();
CREATE INDEX IF NOT EXISTS idx_game_polls_active ON game_polls(library_id, status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_game_sessions_recent ON game_sessions(game_id, played_at DESC);

-- Token expiry indexes for cleanup
CREATE INDEX IF NOT EXISTS idx_email_tokens_expires ON email_confirmation_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires ON password_reset_tokens(expires_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════════════════════════════════════

-- Log successful migration
INSERT INTO site_settings (key, value) VALUES 
    ('schema_version', '2.3.0'),
    ('installed_at', now()::text)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Seed default achievements
INSERT INTO achievements (slug, name, description, category, tier, points, requirement_type, requirement_value, is_secret) VALUES
    -- Collection achievements
    ('first_game', 'First Game', 'Add your first game to the collection', 'collection', 1, 10, 'games_added', 1, false),
    ('collector_10', 'Growing Collection', 'Add 10 games to the collection', 'collection', 1, 25, 'games_added', 10, false),
    ('collector_50', 'Serious Collector', 'Add 50 games to the collection', 'collection', 2, 50, 'games_added', 50, false),
    ('collector_100', 'Master Collector', 'Add 100 games to the collection', 'collection', 3, 100, 'games_added', 100, false),
    ('collector_250', 'Legendary Hoarder', 'Add 250 games to the collection', 'collection', 4, 250, 'games_added', 250, false),
    
    -- Social achievements
    ('first_member', 'Welcome!', 'Someone joined your library', 'social', 1, 15, 'members_count', 1, false),
    ('community_10', 'Community Builder', '10 members in your library', 'social', 2, 50, 'members_count', 10, false),
    ('community_50', 'Town Square', '50 members in your library', 'social', 3, 100, 'members_count', 50, false),
    
    -- Engagement achievements
    ('first_play', 'Game Night!', 'Log your first play session', 'engagement', 1, 10, 'plays_logged', 1, false),
    ('plays_10', 'Regular Player', 'Log 10 play sessions', 'engagement', 1, 25, 'plays_logged', 10, false),
    ('plays_50', 'Dedicated Gamer', 'Log 50 play sessions', 'engagement', 2, 50, 'plays_logged', 50, false),
    ('first_loan', 'Sharing is Caring', 'Lend your first game', 'engagement', 1, 20, 'loans_made', 1, false),
    ('first_event', 'Event Organizer', 'Create your first event', 'engagement', 1, 15, 'events_created', 1, false),
    
    -- Special achievements
    ('early_adopter', 'Early Adopter', 'Joined during the early days', 'special', 1, 100, 'special', 1, true),
    ('premium_member', 'Premium Supporter', 'Upgraded to premium', 'special', 1, 50, 'special', 1, false)
ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION COMPLETE
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- Schema version: 2.3.0
-- 
-- Key security notes for production:
-- 1. owner_id is hidden from public via libraries_public view
-- 2. User roles are in a separate table (prevents privilege escalation)
-- 3. Sensitive Discord/Turnstile keys excluded from public views
-- 4. IP addresses and fingerprints hidden from game_ratings_library_view
-- 5. All security-definer functions have search_path set
-- 6. Library members view restricted to authenticated members only
--
-- Post-migration steps:
-- 1. Create admin user: ./scripts/create-admin.sh
-- 2. Configure SSL: ./scripts/setup-ssl.sh
-- 3. Set up cron jobs: ./scripts/setup-cron.sh
-- ═══════════════════════════════════════════════════════════════════════════
