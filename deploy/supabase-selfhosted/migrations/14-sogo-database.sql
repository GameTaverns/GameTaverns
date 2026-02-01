-- ============================================
-- SOGo Groupware Database Setup
-- Version: 2.2.0 - 5-Tier Role Hierarchy
-- ============================================
-- Creates separate database and user for SOGo webmail/groupware

-- Create SOGo user if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sogo') THEN
        CREATE ROLE sogo WITH LOGIN PASSWORD current_setting('app.sogo_password', true);
    END IF;
END
$$;

-- Create SOGo database if not exists
-- Note: This must be run as superuser
SELECT 'CREATE DATABASE sogo OWNER sogo'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sogo');

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE sogo TO sogo;

-- SOGo will create its own tables on first run
