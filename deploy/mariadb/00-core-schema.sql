-- =============================================
-- GameTaverns Core Schema
-- MariaDB 10.6+
-- =============================================

-- Create core schema (MariaDB uses databases, not schemas)
CREATE DATABASE IF NOT EXISTS gametaverns_core 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE gametaverns_core;

-- =============================================
-- ENUM TYPES (stored as table for reference)
-- =============================================

-- Platform roles
-- ENUM('user', 'admin', 'super_admin')

-- Tenant roles  
-- ENUM('owner', 'admin', 'member')

-- Tenant status
-- ENUM('pending', 'active', 'suspended', 'deleted')

-- Token types
-- ENUM('email_verify', 'password_reset', 'invite')

-- =============================================
-- CORE TABLES
-- =============================================

-- Platform Users (can own/access multiple tenants)
CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    email VARCHAR(255) NOT NULL,
    email_normalized VARCHAR(255) GENERATED ALWAYS AS (LOWER(TRIM(email))) STORED,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    avatar_url VARCHAR(500),
    
    -- Platform role
    platform_role ENUM('user', 'admin', 'super_admin') NOT NULL DEFAULT 'user',
    
    -- Status
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    status ENUM('active', 'suspended', 'deleted') NOT NULL DEFAULT 'active',
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP NULL,
    deleted_at TIMESTAMP NULL,
    
    -- Indexes
    UNIQUE KEY idx_email_unique (email_normalized),
    INDEX idx_status (status),
    INDEX idx_platform_role (platform_role)
) ENGINE=InnoDB;

-- Tenant Registry
CREATE TABLE IF NOT EXISTS tenants (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    slug VARCHAR(63) NOT NULL,
    slug_normalized VARCHAR(63) GENERATED ALWAYS AS (LOWER(TRIM(slug))) STORED,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url VARCHAR(500),
    
    -- Owner reference
    owner_id CHAR(36) NOT NULL,
    
    -- Database schema name
    schema_name VARCHAR(63) NOT NULL,
    
    -- Status
    status ENUM('pending', 'active', 'suspended', 'deleted') NOT NULL DEFAULT 'pending',
    
    -- Settings (JSON)
    settings JSON,
    theme JSON,
    feature_flags JSON,
    
    -- Limits
    max_games INT NOT NULL DEFAULT 500,
    max_storage_mb INT NOT NULL DEFAULT 1000,
    current_game_count INT NOT NULL DEFAULT 0,
    current_storage_mb DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- Foreign keys
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT,
    
    -- Indexes
    UNIQUE KEY idx_slug_unique (slug_normalized),
    UNIQUE KEY idx_schema_unique (schema_name),
    INDEX idx_owner (owner_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- User-Tenant Memberships
CREATE TABLE IF NOT EXISTS tenant_members (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    role ENUM('owner', 'admin', 'member') NOT NULL,
    
    -- Permissions (JSON for flexibility)
    permissions JSON,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    invited_by CHAR(36),
    invited_at TIMESTAMP NULL,
    accepted_at TIMESTAMP NULL,
    
    -- Foreign keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Unique membership
    UNIQUE KEY idx_unique_membership (tenant_id, user_id),
    INDEX idx_user_tenants (user_id),
    INDEX idx_tenant_members (tenant_id)
) ENGINE=InnoDB;

-- Auth Tokens (verification, password reset, invites)
CREATE TABLE IF NOT EXISTS auth_tokens (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    token_type ENUM('email_verify', 'password_reset', 'invite', 'api_key') NOT NULL,
    
    -- For invite tokens
    tenant_id CHAR(36),
    invite_role ENUM('owner', 'admin', 'member'),
    
    -- Expiration
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_token (token_hash),
    INDEX idx_user_tokens (user_id, token_type),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB;

-- Platform Settings
CREATE TABLE IF NOT EXISTS platform_settings (
    key_name VARCHAR(100) PRIMARY KEY,
    value TEXT,
    value_type ENUM('string', 'number', 'boolean', 'json') NOT NULL DEFAULT 'string',
    description TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by CHAR(36),
    
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    
    -- Who
    user_id CHAR(36),
    user_email VARCHAR(255),
    
    -- What
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id CHAR(36),
    
    -- Where
    tenant_id CHAR(36),
    tenant_slug VARCHAR(63),
    
    -- Details
    details JSON,
    old_values JSON,
    new_values JSON,
    
    -- Context
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_id CHAR(36),
    
    -- When
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes (no foreign keys for performance)
    INDEX idx_user (user_id),
    INDEX idx_tenant (tenant_id),
    INDEX idx_action (action),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- Session Storage (for persistent sessions)
CREATE TABLE IF NOT EXISTS sessions (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    
    -- Session data
    tenant_id CHAR(36),
    device_info JSON,
    
    -- Expiration
    expires_at TIMESTAMP NOT NULL,
    last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Context
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_user_sessions (user_id),
    INDEX idx_expires (expires_at),
    INDEX idx_token (token_hash)
) ENGINE=InnoDB;

-- =============================================
-- VIEWS
-- =============================================

-- Active tenants with owner info
CREATE OR REPLACE VIEW v_tenants_with_owners AS
SELECT 
    t.id,
    t.slug,
    t.display_name,
    t.description,
    t.logo_url,
    t.schema_name,
    t.status,
    t.settings,
    t.theme,
    t.feature_flags,
    t.max_games,
    t.current_game_count,
    t.created_at,
    t.updated_at,
    u.id AS owner_id,
    u.email AS owner_email,
    u.display_name AS owner_name
FROM tenants t
JOIN users u ON t.owner_id = u.id
WHERE t.status != 'deleted';

-- User's tenants
CREATE OR REPLACE VIEW v_user_tenants AS
SELECT 
    tm.user_id,
    tm.role AS member_role,
    t.id AS tenant_id,
    t.slug,
    t.display_name,
    t.description,
    t.logo_url,
    t.status,
    t.settings,
    t.theme
FROM tenant_members tm
JOIN tenants t ON tm.tenant_id = t.id
WHERE t.status = 'active';

-- =============================================
-- STORED PROCEDURES
-- =============================================

DELIMITER //

-- Create a new tenant with schema
CREATE PROCEDURE sp_create_tenant(
    IN p_slug VARCHAR(63),
    IN p_display_name VARCHAR(255),
    IN p_owner_id CHAR(36),
    OUT p_tenant_id CHAR(36),
    OUT p_schema_name VARCHAR(63)
)
BEGIN
    DECLARE v_tenant_id CHAR(36) DEFAULT UUID();
    DECLARE v_schema_name VARCHAR(63);
    
    -- Generate schema name
    SET v_schema_name = CONCAT('tenant_', LOWER(REPLACE(p_slug, '-', '_')));
    
    -- Insert tenant record
    INSERT INTO tenants (id, slug, display_name, owner_id, schema_name, status)
    VALUES (v_tenant_id, p_slug, p_display_name, p_owner_id, v_schema_name, 'active');
    
    -- Add owner as member
    INSERT INTO tenant_members (tenant_id, user_id, role)
    VALUES (v_tenant_id, p_owner_id, 'owner');
    
    -- Return values
    SET p_tenant_id = v_tenant_id;
    SET p_schema_name = v_schema_name;
    
    -- Note: The actual schema creation is done separately by the application
    -- because MariaDB doesn't support dynamic DDL in stored procedures well
END //

-- Get user's role in a tenant
CREATE FUNCTION fn_get_tenant_role(
    p_user_id CHAR(36),
    p_tenant_id CHAR(36)
) RETURNS VARCHAR(20)
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_role VARCHAR(20);
    
    SELECT role INTO v_role
    FROM tenant_members
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id;
    
    RETURN COALESCE(v_role, 'none');
END //

-- Check if user has role in tenant
CREATE FUNCTION fn_has_tenant_role(
    p_user_id CHAR(36),
    p_tenant_id CHAR(36),
    p_required_role VARCHAR(20)
) RETURNS BOOLEAN
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_has_role BOOLEAN DEFAULT FALSE;
    
    SELECT 
        CASE 
            WHEN role = 'owner' THEN TRUE
            WHEN role = 'admin' AND p_required_role IN ('admin', 'member') THEN TRUE
            WHEN role = 'member' AND p_required_role = 'member' THEN TRUE
            ELSE FALSE
        END INTO v_has_role
    FROM tenant_members
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id;
    
    RETURN COALESCE(v_has_role, FALSE);
END //

-- Clean up expired sessions
CREATE PROCEDURE sp_cleanup_expired_sessions()
BEGIN
    DELETE FROM sessions WHERE expires_at < NOW();
    DELETE FROM auth_tokens WHERE expires_at < NOW() AND used_at IS NULL;
END //

DELIMITER ;

-- =============================================
-- INITIAL DATA
-- =============================================

-- Default platform settings
INSERT INTO platform_settings (key_name, value, value_type, description) VALUES
('site_name', 'GameTaverns', 'string', 'Platform name'),
('site_description', 'Create your own board game library', 'string', 'Platform description'),
('max_free_games', '100', 'number', 'Max games for free tier'),
('max_free_storage_mb', '500', 'number', 'Max storage for free tier'),
('allow_public_signup', 'true', 'boolean', 'Allow new user signups'),
('require_email_verification', 'true', 'boolean', 'Require email verification'),
('default_tenant_settings', '{"allowWishlist":true,"allowRatings":true,"allowPlayLogs":true}', 'json', 'Default settings for new tenants'),
('maintenance_mode', 'false', 'boolean', 'Enable maintenance mode')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- =============================================
-- EVENTS (for cleanup)
-- =============================================

-- Enable event scheduler
SET GLOBAL event_scheduler = ON;

-- Daily cleanup event
CREATE EVENT IF NOT EXISTS evt_daily_cleanup
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO CALL sp_cleanup_expired_sessions();
