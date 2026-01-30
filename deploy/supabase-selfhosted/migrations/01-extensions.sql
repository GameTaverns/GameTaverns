-- =============================================================================
-- GameTaverns Self-Hosted: Extensions & Prerequisites
-- This is a FRESH database - completely isolated from Lovable Cloud
-- =============================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA extensions;

-- Create extensions schema if it doesn't exist (Supabase image should have it)
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant extensions usage to all roles
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Allow public access to extension functions
ALTER DEFAULT PRIVILEGES IN SCHEMA extensions GRANT EXECUTE ON FUNCTIONS TO postgres, anon, authenticated, service_role;
