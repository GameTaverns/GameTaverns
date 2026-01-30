-- =============================================================================
-- GameTaverns Self-Hosted: Custom Enums
-- =============================================================================

-- App roles
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('admin', 'moderator');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Library member roles
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
        'collection',
        'social',
        'engagement',
        'special'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Feedback types
DO $$ BEGIN
    CREATE TYPE feedback_type AS ENUM (
        'bug',
        'feature',
        'general'
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
