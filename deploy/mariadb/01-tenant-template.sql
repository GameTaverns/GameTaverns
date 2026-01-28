-- =============================================
-- GameTaverns Tenant Schema Template
-- MariaDB 10.6+
-- 
-- USAGE: Replace all instances of {TENANT_SLUG} with 
--        the actual tenant slug (e.g., 'tzolak')
--        Schema name will be: tenant_{TENANT_SLUG}
-- =============================================

-- Create tenant database/schema
CREATE DATABASE IF NOT EXISTS tenant_{TENANT_SLUG}
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE tenant_{TENANT_SLUG};

-- =============================================
-- REFERENCE TABLES
-- =============================================

-- Publishers
CREATE TABLE IF NOT EXISTS publishers (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    website_url VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY idx_name (name)
) ENGINE=InnoDB;

-- Mechanics (game mechanism tags)
CREATE TABLE IF NOT EXISTS mechanics (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    bgg_id VARCHAR(20),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY idx_name (name),
    INDEX idx_bgg (bgg_id)
) ENGINE=InnoDB;

-- =============================================
-- MAIN GAMES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS games (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    -- Basic info
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255),
    description TEXT,
    
    -- Images
    image_url VARCHAR(500),
    additional_images JSON,  -- Array of image URLs
    
    -- Media
    youtube_videos JSON,     -- Array of YouTube video IDs
    
    -- Game details
    min_players TINYINT UNSIGNED DEFAULT 1,
    max_players TINYINT UNSIGNED DEFAULT 4,
    play_time ENUM(
        '0-15 Minutes', 
        '15-30 Minutes', 
        '30-45 Minutes', 
        '45-60 Minutes', 
        '60+ Minutes', 
        '2+ Hours', 
        '3+ Hours'
    ) DEFAULT '45-60 Minutes',
    difficulty ENUM(
        '1 - Light', 
        '2 - Medium Light', 
        '3 - Medium', 
        '4 - Medium Heavy', 
        '5 - Heavy'
    ) DEFAULT '3 - Medium',
    game_type ENUM(
        'Board Game', 
        'Card Game', 
        'Dice Game', 
        'Party Game', 
        'War Game', 
        'Miniatures', 
        'RPG', 
        'Other'
    ) DEFAULT 'Board Game',
    suggested_age VARCHAR(20) DEFAULT '10+',
    
    -- BGG Integration
    bgg_id VARCHAR(20),
    bgg_url VARCHAR(500),
    
    -- Expansion info
    is_expansion BOOLEAN NOT NULL DEFAULT FALSE,
    parent_game_id CHAR(36),
    in_base_game_box BOOLEAN DEFAULT FALSE,
    
    -- Sale info
    is_for_sale BOOLEAN NOT NULL DEFAULT FALSE,
    sale_price DECIMAL(10,2),
    sale_condition ENUM(
        'New/Sealed', 
        'Like New', 
        'Very Good', 
        'Good', 
        'Acceptable'
    ),
    
    -- Status
    is_coming_soon BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Collection details
    sleeved BOOLEAN DEFAULT FALSE,
    upgraded_components BOOLEAN DEFAULT FALSE,
    crowdfunded BOOLEAN DEFAULT FALSE,
    inserts BOOLEAN DEFAULT FALSE,
    
    -- Location
    location_room VARCHAR(100),
    location_shelf VARCHAR(100),
    location_misc VARCHAR(255),
    
    -- References
    publisher_id CHAR(36),
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (parent_game_id) REFERENCES games(id) ON DELETE SET NULL,
    FOREIGN KEY (publisher_id) REFERENCES publishers(id) ON DELETE SET NULL,
    
    -- Indexes
    UNIQUE KEY idx_slug (slug),
    INDEX idx_title (title),
    INDEX idx_is_expansion (is_expansion),
    INDEX idx_parent_game (parent_game_id),
    INDEX idx_is_for_sale (is_for_sale),
    INDEX idx_publisher (publisher_id),
    INDEX idx_bgg (bgg_id),
    FULLTEXT idx_search (title, description)
) ENGINE=InnoDB;

-- Game-Mechanic junction table
CREATE TABLE IF NOT EXISTS game_mechanics (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    game_id CHAR(36) NOT NULL,
    mechanic_id CHAR(36) NOT NULL,
    
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (mechanic_id) REFERENCES mechanics(id) ON DELETE CASCADE,
    
    UNIQUE KEY idx_game_mechanic (game_id, mechanic_id),
    INDEX idx_mechanic (mechanic_id)
) ENGINE=InnoDB;

-- =============================================
-- ADMIN-ONLY DATA
-- =============================================

-- Admin-only game data (purchase info, notes)
CREATE TABLE IF NOT EXISTS game_admin_data (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    game_id CHAR(36) NOT NULL,
    
    -- Purchase info
    purchase_price DECIMAL(10,2),
    purchase_date DATE,
    purchase_source VARCHAR(255),
    
    -- Private notes
    private_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    UNIQUE KEY idx_game (game_id)
) ENGINE=InnoDB;

-- =============================================
-- PLAY SESSIONS
-- =============================================

-- Game sessions (play logs)
CREATE TABLE IF NOT EXISTS game_sessions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    game_id CHAR(36) NOT NULL,
    
    -- Session details
    played_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duration_minutes INT UNSIGNED,
    location VARCHAR(255),
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    
    INDEX idx_game (game_id),
    INDEX idx_played_at (played_at)
) ENGINE=InnoDB;

-- Session players
CREATE TABLE IF NOT EXISTS game_session_players (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    session_id CHAR(36) NOT NULL,
    
    -- Player info
    player_name VARCHAR(100) NOT NULL,
    score INT,
    is_winner BOOLEAN NOT NULL DEFAULT FALSE,
    is_first_play BOOLEAN NOT NULL DEFAULT FALSE,
    color VARCHAR(50),
    faction VARCHAR(100),
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
    
    INDEX idx_session (session_id),
    INDEX idx_player (player_name)
) ENGINE=InnoDB;

-- =============================================
-- VISITOR INTERACTIONS
-- =============================================

-- Wishlist (visitor votes for games)
CREATE TABLE IF NOT EXISTS game_wishlist (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    game_id CHAR(36) NOT NULL,
    
    -- Visitor identification
    guest_identifier VARCHAR(255) NOT NULL,  -- Cookie or fingerprint
    guest_name VARCHAR(100),                 -- Optional: name they provide
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    
    UNIQUE KEY idx_unique_vote (game_id, guest_identifier),
    INDEX idx_game (game_id)
) ENGINE=InnoDB;

-- Ratings
CREATE TABLE IF NOT EXISTS game_ratings (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    game_id CHAR(36) NOT NULL,
    
    -- Visitor identification
    guest_identifier VARCHAR(255) NOT NULL,
    
    -- Rating
    rating TINYINT UNSIGNED NOT NULL CHECK (rating BETWEEN 1 AND 5),
    
    -- Anti-fraud
    ip_address VARCHAR(45),
    device_fingerprint VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    
    UNIQUE KEY idx_unique_rating (game_id, guest_identifier),
    INDEX idx_game (game_id)
) ENGINE=InnoDB;

-- Contact messages (encrypted PII)
CREATE TABLE IF NOT EXISTS game_messages (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    game_id CHAR(36) NOT NULL,
    
    -- Encrypted PII
    sender_name_encrypted TEXT,
    sender_email_encrypted TEXT,
    message_encrypted TEXT,
    sender_ip_encrypted TEXT,
    
    -- Status
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    is_spam BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Reply tracking
    replied_at TIMESTAMP NULL,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    
    INDEX idx_game (game_id),
    INDEX idx_unread (is_read, is_archived, created_at)
) ENGINE=InnoDB;

-- =============================================
-- SETTINGS & CONFIGURATION
-- =============================================

-- Tenant settings (key-value store)
CREATE TABLE IF NOT EXISTS settings (
    key_name VARCHAR(100) PRIMARY KEY,
    value TEXT,
    value_type ENUM('string', 'number', 'boolean', 'json') NOT NULL DEFAULT 'string',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Feature flags
CREATE TABLE IF NOT EXISTS feature_flags (
    key_name VARCHAR(100) PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    config JSON,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================
-- VIEWS
-- =============================================

-- Public games view (excludes admin data)
CREATE OR REPLACE VIEW games_public AS
SELECT 
    id, title, slug, description, image_url, additional_images, youtube_videos,
    min_players, max_players, play_time, difficulty, game_type, suggested_age,
    bgg_id, bgg_url, is_expansion, parent_game_id, in_base_game_box,
    is_for_sale, sale_price, sale_condition, is_coming_soon,
    sleeved, upgraded_components, crowdfunded, inserts,
    location_room, location_shelf, location_misc,
    publisher_id, created_at, updated_at
FROM games;

-- Rating summary per game
CREATE OR REPLACE VIEW game_ratings_summary AS
SELECT 
    game_id,
    COUNT(*) AS rating_count,
    ROUND(AVG(rating), 2) AS average_rating,
    SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS five_star_count,
    SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS four_star_count,
    SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS three_star_count,
    SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS two_star_count,
    SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS one_star_count
FROM game_ratings
GROUP BY game_id;

-- Wishlist summary per game
CREATE OR REPLACE VIEW game_wishlist_summary AS
SELECT 
    game_id,
    COUNT(*) AS vote_count,
    COUNT(CASE WHEN guest_name IS NOT NULL AND guest_name != '' THEN 1 END) AS named_votes
FROM game_wishlist
GROUP BY game_id;

-- Play statistics per game
CREATE OR REPLACE VIEW game_play_stats AS
SELECT 
    g.id AS game_id,
    COUNT(DISTINCT gs.id) AS total_plays,
    COUNT(DISTINCT gsp.player_name) AS unique_players,
    MAX(gs.played_at) AS last_played,
    MIN(gs.played_at) AS first_played,
    AVG(gs.duration_minutes) AS avg_duration_minutes
FROM games g
LEFT JOIN game_sessions gs ON g.id = gs.game_id
LEFT JOIN game_session_players gsp ON gs.id = gsp.session_id
GROUP BY g.id;

-- Games with all stats
CREATE OR REPLACE VIEW games_with_stats AS
SELECT 
    g.*,
    COALESCE(r.average_rating, 0) AS average_rating,
    COALESCE(r.rating_count, 0) AS rating_count,
    COALESCE(w.vote_count, 0) AS wishlist_count,
    COALESCE(p.total_plays, 0) AS total_plays,
    p.last_played
FROM games g
LEFT JOIN game_ratings_summary r ON g.id = r.game_id
LEFT JOIN game_wishlist_summary w ON g.id = w.game_id
LEFT JOIN game_play_stats p ON g.id = p.game_id;

-- =============================================
-- TRIGGERS
-- =============================================

DELIMITER //

-- Auto-generate slug on insert
CREATE TRIGGER tr_games_before_insert
BEFORE INSERT ON games
FOR EACH ROW
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        SET NEW.slug = LOWER(REGEXP_REPLACE(
            REGEXP_REPLACE(NEW.title, '[^a-zA-Z0-9\\s-]', ''),
            '\\s+', '-'
        ));
    END IF;
END //

-- Update slug on title change
CREATE TRIGGER tr_games_before_update
BEFORE UPDATE ON games
FOR EACH ROW
BEGIN
    IF NEW.title != OLD.title AND (NEW.slug IS NULL OR NEW.slug = OLD.slug) THEN
        SET NEW.slug = LOWER(REGEXP_REPLACE(
            REGEXP_REPLACE(NEW.title, '[^a-zA-Z0-9\\s-]', ''),
            '\\s+', '-'
        ));
    END IF;
END //

DELIMITER ;

-- =============================================
-- DEFAULT DATA
-- =============================================

-- Default feature flags
INSERT INTO feature_flags (key_name, enabled, config) VALUES
('wishlist', TRUE, '{"allowAnonymous": true, "requireName": false}'),
('ratings', TRUE, '{"allowAnonymous": true, "ratingScale": 5}'),
('play_logs', TRUE, '{"publiclyVisible": true}'),
('for_sale', TRUE, '{"enableContactForm": true}'),
('messaging', TRUE, '{"requireTurnstile": true}'),
('bgg_import', TRUE, NULL)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- Default settings
INSERT INTO settings (key_name, value, value_type) VALUES
('site_name', 'My Game Library', 'string'),
('site_description', 'Welcome to my board game collection!', 'string'),
('theme_primary_color', '#3b82f6', 'string'),
('theme_accent_color', '#10b981', 'string'),
('show_location', 'true', 'boolean'),
('show_price_info', 'false', 'boolean'),
('default_sort', 'title_asc', 'string'),
('games_per_page', '24', 'number'),
('enable_search', 'true', 'boolean'),
('contact_email', '', 'string'),
('turnstile_site_key', '', 'string')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;
