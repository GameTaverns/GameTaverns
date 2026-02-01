-- ============================================
-- SOGo Groupware Database Setup
-- Version: 2.2.0 - 5-Tier Role Hierarchy
-- ============================================
-- Creates SOGo user role for groupware authentication
-- Note: SOGo uses the main postgres database, not a separate DB
-- The SOGo container handles its own schema creation on startup

-- Create SOGo schema for groupware data (contained within main DB)
CREATE SCHEMA IF NOT EXISTS sogo;

-- Create SOGo role if not exists (with a default password that should be changed)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sogo') THEN
        -- Create role with login capability
        -- Password should match SOGO_DB_PASSWORD in docker-compose
        CREATE ROLE sogo WITH LOGIN PASSWORD 'sogo_password_change_me';
        RAISE NOTICE 'Created sogo role - remember to set SOGO_DB_PASSWORD in .env';
    ELSE
        RAISE NOTICE 'sogo role already exists';
    END IF;
END
$$;

-- Grant permissions on sogo schema
GRANT USAGE ON SCHEMA sogo TO sogo;
GRANT CREATE ON SCHEMA sogo TO sogo;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA sogo TO sogo;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA sogo TO sogo;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA sogo GRANT ALL ON TABLES TO sogo;
ALTER DEFAULT PRIVILEGES IN SCHEMA sogo GRANT ALL ON SEQUENCES TO sogo;

-- SOGo also needs access to check the public schema for some queries
GRANT USAGE ON SCHEMA public TO sogo;

RAISE NOTICE 'SOGo database setup complete';
