-- =============================================================================
-- GameTaverns Self-Hosted: Extensions & Prerequisites
-- This is a FRESH database - completely isolated from Lovable Cloud
-- Version: 2.3.3 - GoTrue Compatibility Fix
-- =============================================================================

-- =============================================================================
-- CRITICAL: Create 'postgres' role for GoTrue compatibility
-- GoTrue's internal migrations hardcode grants to 'postgres' role, but
-- Supabase's Docker Postgres image uses 'supabase_admin' as superuser.
-- This creates the expected role to prevent migration failures.
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        CREATE ROLE postgres WITH LOGIN SUPERUSER;
        RAISE NOTICE 'Created postgres role for GoTrue compatibility';
    END IF;
END $$;

-- Create auth schema for GoTrue (must exist before auth container starts)
CREATE SCHEMA IF NOT EXISTS auth;
ALTER SCHEMA auth OWNER TO supabase_admin;
GRANT USAGE, CREATE ON SCHEMA auth TO supabase_auth_admin;

-- Create storage schema for storage-api
CREATE SCHEMA IF NOT EXISTS storage;
ALTER SCHEMA storage OWNER TO supabase_admin;
GRANT USAGE, CREATE ON SCHEMA storage TO supabase_storage_admin;

-- Create extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;

-- Required extensions (installed into extensions schema)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA extensions;

-- Grant database-level permissions to service roles
GRANT CONNECT, TEMP ON DATABASE postgres TO supabase_auth_admin, supabase_storage_admin;
GRANT USAGE, CREATE ON SCHEMA public TO supabase_auth_admin, supabase_storage_admin;

-- Grant extensions usage to all roles that exist in Supabase
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        GRANT USAGE ON SCHEMA extensions TO postgres;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO postgres;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        GRANT USAGE ON SCHEMA extensions TO anon;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT USAGE ON SCHEMA extensions TO authenticated;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT USAGE ON SCHEMA extensions TO service_role;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO service_role;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
        GRANT USAGE ON SCHEMA extensions TO supabase_admin;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO supabase_admin;
    END IF;
END $$;

-- Set default privileges for future functions
ALTER DEFAULT PRIVILEGES IN SCHEMA extensions GRANT EXECUTE ON FUNCTIONS TO postgres;
