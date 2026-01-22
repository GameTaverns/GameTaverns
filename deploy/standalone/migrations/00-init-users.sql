-- Initialize Supabase internal users with correct passwords
-- This runs during postgres container init (before other services connect)

-- Set password for auth admin (used by GoTrue)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin WITH LOGIN;
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
    CREATE ROLE supabase_admin WITH LOGIN;
  END IF;
  EXECUTE format('ALTER ROLE supabase_admin WITH PASSWORD %L', current_setting('app.settings.postgres_password', true));
END
$$;

-- Set password for storage admin (used by Storage, if enabled)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin WITH LOGIN;
  END IF;
  EXECUTE format('ALTER ROLE supabase_storage_admin WITH PASSWORD %L', current_setting('app.settings.postgres_password', true));
END
$$;
