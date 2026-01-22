-- Initialize Supabase internal users with correct passwords and permissions
-- This runs during postgres container init (before other services connect)

-- Set password for auth admin (used by GoTrue)
-- SUPERUSER is required so GoTrue can create its auth schema and tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin WITH LOGIN SUPERUSER CREATEDB CREATEROLE;
  ELSE
    ALTER ROLE supabase_auth_admin WITH SUPERUSER CREATEDB CREATEROLE;
  END IF;
  EXECUTE format('ALTER ROLE supabase_auth_admin WITH PASSWORD %L', current_setting('app.settings.postgres_password', true));
END
$$;

-- Set password for authenticator (used by PostgREST)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator WITH LOGIN;
  END IF;
  EXECUTE format('ALTER ROLE authenticator WITH PASSWORD %L', current_setting('app.settings.postgres_password', true));
END
$$;

-- Set password for supabase_admin (used by Realtime and Studio)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin WITH LOGIN SUPERUSER CREATEDB CREATEROLE REPLICATION BYPASSRLS;
  END IF;
  EXECUTE format('ALTER ROLE supabase_admin WITH PASSWORD %L', current_setting('app.settings.postgres_password', true));
END
$$;

-- Set password for storage admin (used by Storage, if enabled)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin WITH LOGIN CREATEDB CREATEROLE;
  ELSE
    ALTER ROLE supabase_storage_admin WITH CREATEDB CREATEROLE;
  END IF;
  EXECUTE format('ALTER ROLE supabase_storage_admin WITH PASSWORD %L', current_setting('app.settings.postgres_password', true));
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

-- Grant authenticator the ability to switch to API roles
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;

-- Grant supabase_admin the same
GRANT anon TO supabase_admin;
GRANT authenticated TO supabase_admin;
GRANT service_role TO supabase_admin;

-- Grant public schema usage
GRANT ALL ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON SCHEMA public TO supabase_storage_admin;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
