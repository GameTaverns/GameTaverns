-- Initialize Supabase internal users with correct passwords and permissions
-- This runs during postgres container init (before other services connect)
--
-- NOTE: The supabase/postgres image already creates most of these roles.
-- This script ensures they exist and have correct permissions.
-- Passwords are set via environment variables and the install.sh script.

-- =====================================================
-- CRITICAL: GoTrue migrations require a "postgres" role to exist.
-- When POSTGRES_USER=supabase_admin, the default "postgres" role
-- is NOT created, so we must create it here.
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'postgres') THEN
    CREATE ROLE postgres WITH LOGIN SUPERUSER CREATEDB CREATEROLE REPLICATION BYPASSRLS;
  END IF;
END
$$;

-- Ensure core API roles exist (used by PostgREST/JWT roles + grants in app schema)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
$$;

-- Ensure authenticator role exists (used by PostgREST)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator WITH LOGIN NOINHERIT;
  END IF;
END
$$;

-- Ensure supabase_auth_admin role exists (used by GoTrue)
-- SUPERUSER is required so GoTrue can create its auth schema and tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin WITH LOGIN SUPERUSER CREATEDB CREATEROLE;
  ELSE
    ALTER ROLE supabase_auth_admin WITH SUPERUSER CREATEDB CREATEROLE;
  END IF;
END
$$;

-- Ensure supabase_storage_admin role exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin WITH LOGIN CREATEDB CREATEROLE;
  END IF;
END
$$;

-- Grant authenticator the ability to switch to API roles
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;

-- Grant supabase_admin the same (already exists in supabase/postgres image)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    EXECUTE 'GRANT anon TO supabase_admin';
    EXECUTE 'GRANT authenticated TO supabase_admin';
    EXECUTE 'GRANT service_role TO supabase_admin';
  END IF;
END
$$;

-- Grant public schema usage
GRANT ALL ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON SCHEMA public TO supabase_storage_admin;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
