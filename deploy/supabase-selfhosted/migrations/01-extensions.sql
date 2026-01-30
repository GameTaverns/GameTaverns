-- =============================================================================
-- GameTaverns Self-Hosted: Extensions & Prerequisites
-- This is a FRESH database - completely isolated from Lovable Cloud
-- =============================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Grant extensions to authenticated users
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
