-- =============================================================================
-- GameTaverns Self-Hosted: Extensions & Prerequisites
-- This is a FRESH database - completely isolated from Lovable Cloud
-- =============================================================================

-- Create extensions schema FIRST if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Required extensions (installed into extensions schema)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA extensions;

-- Grant extensions usage to all roles that exist in Supabase
DO $$ 
BEGIN
    -- Grant to roles that exist
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
