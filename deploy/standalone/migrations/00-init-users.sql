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

-- =====================================================
-- Pre-create the auth schema so GoTrue doesn't have issues
-- GoTrue will create its tables/types within this schema
-- =====================================================
CREATE SCHEMA IF NOT EXISTS auth;
GRANT ALL ON SCHEMA auth TO postgres;
GRANT ALL ON SCHEMA auth TO supabase_admin;

-- =====================================================
-- Create auth.uid() stub function for RLS policies
-- GoTrue will replace this with its actual implementation,
-- but we need a stub so the app schema can reference it
-- before GoTrue has fully initialized.
-- =====================================================
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    COALESCE(
      current_setting('request.jwt.claim.sub', true),
      current_setting('request.jwt.claims', true)::json->>'sub'
    ),
    ''
  )::uuid
$$;

GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role, supabase_admin, postgres;

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

-- Grant auth schema to supabase_auth_admin (GoTrue needs this)
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;

-- Set default privileges so GoTrue-created tables are accessible
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth
GRANT ALL ON TABLES TO supabase_auth_admin, supabase_admin, postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth
GRANT ALL ON SEQUENCES TO supabase_auth_admin, supabase_admin, postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth
GRANT ALL ON FUNCTIONS TO supabase_auth_admin, supabase_admin, postgres;

-- Also grant service_role access to auth schema for API calls
GRANT USAGE ON SCHEMA auth TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth
GRANT SELECT ON TABLES TO service_role;

-- =====================================================
-- Create app_role enum and user_roles table EARLY
-- This must exist before any RLS policies that use has_role()
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create has_role function (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Grant access to user_roles for API roles
GRANT SELECT ON public.user_roles TO anon, authenticated, service_role;
GRANT ALL ON public.user_roles TO supabase_admin;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role;

-- =====================================================
-- COMPATIBILITY FIX: Newer Supabase Studio versions expect
-- auth.users to have an is_anonymous column. GoTrue v2.132.3
-- does not create this column, so we add it here if missing.
-- This runs AFTER GoTrue has bootstrapped the auth schema.
-- =====================================================
-- Note: This block is safe to re-run; it only adds the column if
-- the auth.users table exists and lacks the column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_anonymous'
  ) THEN
    ALTER TABLE auth.users ADD COLUMN is_anonymous boolean NOT NULL DEFAULT false;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- If auth.users doesn't exist yet (GoTrue hasn't run), silently skip.
  NULL;
END
$$;
