-- =============================================
-- Migration Script: Postgres (Supabase) → MariaDB
-- GameTaverns Platform
-- =============================================
-- 
-- This script helps migrate data from the current Supabase 
-- (PostgreSQL) database to the new MariaDB multi-tenant structure.
--
-- STEPS:
-- 1. Export data from Supabase using pg_dump or Supabase dashboard
-- 2. Transform the data using this script's patterns
-- 3. Import into MariaDB
--
-- Note: This is a REFERENCE script. The actual migration 
-- will be handled by a Node.js script for better control.
-- =============================================

-- =============================================
-- STEP 1: Export from Supabase (PostgreSQL)
-- Run these queries in Supabase SQL editor to export data
-- =============================================

-- Export users (from auth.users)
-- Note: You'll need to create platform users from this
/*
SELECT 
    id,
    email,
    encrypted_password as password_hash,
    created_at,
    updated_at,
    email_confirmed_at IS NOT NULL as email_verified
FROM auth.users;
*/

-- Export user roles
/*
SELECT 
    user_id,
    role,
    created_at
FROM public.user_roles;
*/

-- Export games
/*
SELECT 
    id,
    title,
    slug,
    description,
    image_url,
    additional_images,
    youtube_videos,
    min_players,
    max_players,
    play_time,
    difficulty,
    game_type,
    suggested_age,
    bgg_id,
    bgg_url,
    is_expansion,
    parent_game_id,
    in_base_game_box,
    is_for_sale,
    sale_price,
    sale_condition,
    is_coming_soon,
    sleeved,
    upgraded_components,
    crowdfunded,
    inserts,
    location_room,
    location_shelf,
    location_misc,
    publisher_id,
    created_at,
    updated_at
FROM public.games;
*/

-- Export publishers
/*
SELECT id, name, created_at FROM public.publishers;
*/

-- Export mechanics
/*
SELECT id, name, created_at FROM public.mechanics;
*/

-- Export game_mechanics
/*
SELECT id, game_id, mechanic_id FROM public.game_mechanics;
*/

-- Export game_sessions
/*
SELECT 
    id,
    game_id,
    played_at,
    duration_minutes,
    notes,
    created_at,
    updated_at
FROM public.game_sessions;
*/

-- Export game_session_players
/*
SELECT 
    id,
    session_id,
    player_name,
    score,
    is_winner,
    is_first_play,
    created_at
FROM public.game_session_players;
*/

-- Export game_wishlist
/*
SELECT 
    id,
    game_id,
    guest_identifier,
    guest_name,
    created_at
FROM public.game_wishlist;
*/

-- Export game_ratings
/*
SELECT 
    id,
    game_id,
    guest_identifier,
    rating,
    ip_address,
    device_fingerprint,
    created_at,
    updated_at
FROM public.game_ratings;
*/

-- Export game_messages
/*
SELECT 
    id,
    game_id,
    sender_name_encrypted,
    sender_email_encrypted,
    message_encrypted,
    sender_ip_encrypted,
    is_read,
    created_at
FROM public.game_messages;
*/

-- Export game_admin_data
/*
SELECT 
    id,
    game_id,
    purchase_price,
    purchase_date,
    created_at,
    updated_at
FROM public.game_admin_data;
*/

-- Export site_settings
/*
SELECT key, value, updated_at FROM public.site_settings;
*/

-- =============================================
-- STEP 2: Data Transformation Notes
-- =============================================

/*
Key transformations needed:

1. USERS
   - Supabase auth.users → gametaverns_core.users
   - encrypted_password can be directly copied (bcrypt compatible)
   - Need to create tenant membership records

2. ARRAY COLUMNS
   - PostgreSQL: text[] or jsonb
   - MariaDB: JSON
   - Transform: array_to_json() in PostgreSQL before export

3. ENUM COLUMNS
   - PostgreSQL: custom enum types
   - MariaDB: ENUM() in column definition
   - Values should match exactly

4. UUID COLUMNS
   - PostgreSQL: uuid type
   - MariaDB: CHAR(36)
   - UUIDs are compatible as strings

5. TIMESTAMPS
   - PostgreSQL: timestamp with time zone
   - MariaDB: TIMESTAMP or DATETIME
   - Convert to UTC before import

6. TENANT CONTEXT
   - Single tenant in Supabase
   - Create one tenant in MariaDB for migration
   - All data goes into that tenant's schema
*/

-- =============================================
-- STEP 3: MariaDB Import Templates
-- =============================================

-- These are templates for importing exported data
-- Replace {TENANT_SLUG} with your tenant slug

-- Import publishers
/*
INSERT INTO tenant_{TENANT_SLUG}.publishers (id, name, created_at)
VALUES 
    (?, ?, ?);
*/

-- Import mechanics  
/*
INSERT INTO tenant_{TENANT_SLUG}.mechanics (id, name, created_at)
VALUES 
    (?, ?, ?);
*/

-- Import games (careful with JSON columns)
/*
INSERT INTO tenant_{TENANT_SLUG}.games (
    id, title, slug, description, image_url,
    additional_images, youtube_videos,
    min_players, max_players, play_time, difficulty,
    game_type, suggested_age, bgg_id, bgg_url,
    is_expansion, parent_game_id, in_base_game_box,
    is_for_sale, sale_price, sale_condition, is_coming_soon,
    sleeved, upgraded_components, crowdfunded, inserts,
    location_room, location_shelf, location_misc,
    publisher_id, created_at, updated_at
)
VALUES (
    ?, ?, ?, ?, ?,
    ?, ?,  -- JSON columns
    ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?,
    ?, ?, ?
);
*/

-- =============================================
-- STEP 4: Verification Queries
-- =============================================

-- After import, run these to verify data integrity

-- Check game counts
/*
SELECT 
    (SELECT COUNT(*) FROM tenant_{TENANT_SLUG}.games) as games_count,
    (SELECT COUNT(*) FROM tenant_{TENANT_SLUG}.publishers) as publishers_count,
    (SELECT COUNT(*) FROM tenant_{TENANT_SLUG}.mechanics) as mechanics_count,
    (SELECT COUNT(*) FROM tenant_{TENANT_SLUG}.game_sessions) as sessions_count,
    (SELECT COUNT(*) FROM tenant_{TENANT_SLUG}.game_wishlist) as wishlist_count,
    (SELECT COUNT(*) FROM tenant_{TENANT_SLUG}.game_ratings) as ratings_count;
*/

-- Check for orphaned records
/*
SELECT 'Orphaned game_mechanics' as issue, COUNT(*) as count
FROM tenant_{TENANT_SLUG}.game_mechanics gm
LEFT JOIN tenant_{TENANT_SLUG}.games g ON gm.game_id = g.id
WHERE g.id IS NULL

UNION ALL

SELECT 'Orphaned sessions', COUNT(*)
FROM tenant_{TENANT_SLUG}.game_sessions gs
LEFT JOIN tenant_{TENANT_SLUG}.games g ON gs.game_id = g.id
WHERE g.id IS NULL

UNION ALL

SELECT 'Orphaned wishlist', COUNT(*)
FROM tenant_{TENANT_SLUG}.game_wishlist gw
LEFT JOIN tenant_{TENANT_SLUG}.games g ON gw.game_id = g.id
WHERE g.id IS NULL;
*/

-- Verify foreign key relationships
/*
SELECT 
    g.id,
    g.title,
    p.name as publisher_name,
    parent.title as parent_game_title
FROM tenant_{TENANT_SLUG}.games g
LEFT JOIN tenant_{TENANT_SLUG}.publishers p ON g.publisher_id = p.id
LEFT JOIN tenant_{TENANT_SLUG}.games parent ON g.parent_game_id = parent.id
LIMIT 10;
*/
