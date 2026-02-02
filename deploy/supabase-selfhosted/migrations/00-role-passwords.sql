-- =============================================================================
-- GameTaverns Self-Hosted: Bootstrap Role Passwords
-- Version: 2.3.4
--
-- CRITICAL: This must run FIRST (00-*) during initdb.
-- Sets passwords for all service roles so GoTrue/PostgREST/Storage can connect.
--
-- Note: This uses POSTGRES_PASSWORD which is injected by the entrypoint.
-- The supabase/postgres image automatically substitutes :POSTGRES_PASSWORD
-- when this file is processed during initdb.
-- =============================================================================

-- Create postgres role for GoTrue compatibility (it hardcodes grants to this role)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        CREATE ROLE postgres WITH LOGIN SUPERUSER;
        RAISE NOTICE 'Created postgres role';
    END IF;
END $$;

-- Create authenticator role (PostgREST uses this)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
        CREATE ROLE authenticator WITH LOGIN NOINHERIT;
        RAISE NOTICE 'Created authenticator role';
    END IF;
END $$;

-- Create API roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN BYPASSRLS;
    END IF;
END $$;

-- Create service admin roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        CREATE ROLE supabase_auth_admin WITH LOGIN SUPERUSER CREATEDB CREATEROLE;
        RAISE NOTICE 'Created supabase_auth_admin role';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
        CREATE ROLE supabase_storage_admin WITH LOGIN CREATEDB CREATEROLE;
        RAISE NOTICE 'Created supabase_storage_admin role';
    END IF;
END $$;

-- Grant role memberships
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;
GRANT anon TO supabase_admin;
GRANT authenticated TO supabase_admin;
GRANT service_role TO supabase_admin;

-- =============================================================================
-- SET PASSWORDS - Uses environment variable from Docker
-- The supabase/postgres entrypoint sets these via psql -v
-- =============================================================================
ALTER ROLE authenticator WITH LOGIN PASSWORD :'POSTGRES_PASSWORD';
ALTER ROLE supabase_auth_admin WITH LOGIN PASSWORD :'POSTGRES_PASSWORD';
ALTER ROLE supabase_storage_admin WITH LOGIN PASSWORD :'POSTGRES_PASSWORD';
ALTER ROLE postgres WITH LOGIN PASSWORD :'POSTGRES_PASSWORD';
