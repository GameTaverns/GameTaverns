-- =============================================================================
-- GameTaverns Self-Hosted: Custom Enums
-- Version: 2.3.2 - Schema Parity Audit
-- =============================================================================

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

-- Library member roles (Community-level roles within a specific library)
-- moderator - Can manage polls, events, remove users within their community
-- member    - Regular community member
DO $$ BEGIN
    CREATE TYPE library_member_role AS ENUM ('member', 'moderator');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Game difficulty levels
DO $$ BEGIN
    CREATE TYPE difficulty_level AS ENUM (
        '1 - Very Easy',
        '2 - Easy', 
        '3 - Medium',
        '4 - Hard',
        '5 - Very Hard'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Game types
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
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Play time ranges
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
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Sale condition
DO $$ BEGIN
    CREATE TYPE sale_condition AS ENUM (
        'New',
        'Like New',
        'Very Good',
        'Good',
        'Acceptable'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Loan status
DO $$ BEGIN
    CREATE TYPE loan_status AS ENUM (
        'requested',
        'approved',
        'borrowed',
        'returned',
        'declined',
        'cancelled'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Achievement categories
DO $$ BEGIN
    CREATE TYPE achievement_category AS ENUM (
        'collector',
        'player',
        'social',
        'explorer',
        'contributor',
        'lender'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Feedback types
DO $$ BEGIN
    CREATE TYPE feedback_type AS ENUM (
        'feedback',
        'bug',
        'feature_request'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Suspension actions
DO $$ BEGIN
    CREATE TYPE suspension_action AS ENUM (
        'suspended',
        'reinstated'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
