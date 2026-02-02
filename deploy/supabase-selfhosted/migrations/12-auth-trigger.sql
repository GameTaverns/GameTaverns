-- =============================================================================
-- GameTaverns Self-Hosted: Auth Trigger Setup
-- This creates the trigger on auth.users to auto-create profiles
-- Must be run after the Supabase auth schema is initialized
-- Version: 2.3.2 - Schema Parity Audit
-- =============================================================================

-- Create trigger on auth.users to auto-create user profiles
-- This runs as superuser through the Supabase PostgreSQL image
DO $$
DECLARE
    auth_exists BOOLEAN := false;
    users_exists BOOLEAN := false;
BEGIN
    -- Check if auth schema exists
    SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') INTO auth_exists;
    
    IF NOT auth_exists THEN
        RAISE NOTICE 'Auth schema does not exist yet - trigger will be created when auth initializes';
        RETURN;
    END IF;
    
    -- Check if auth.users table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) INTO users_exists;
    
    IF NOT users_exists THEN
        RAISE NOTICE 'auth.users table does not exist yet - trigger will be created when auth initializes';
        RETURN;
    END IF;
    
    -- Check if the function exists before creating trigger
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_user_profile' AND pronamespace = 'public'::regnamespace) THEN
        RAISE NOTICE 'create_user_profile function does not exist - run 08-functions-triggers.sql first';
        RETURN;
    END IF;
    
    -- Drop existing trigger if it exists (for clean re-runs)
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    
    -- Create the trigger
    CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW
        EXECUTE FUNCTION public.create_user_profile();
        
    RAISE NOTICE 'Auth trigger on_auth_user_created created successfully';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create auth trigger: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END $$;

-- Grant necessary permissions for the auth service
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
        GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_auth_admin;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO supabase_auth_admin;
        RAISE NOTICE 'Granted permissions to supabase_auth_admin';
    ELSE
        RAISE NOTICE 'Role supabase_auth_admin does not exist yet - will be created by auth service';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not grant permissions to supabase_auth_admin: %', SQLERRM;
END $$;

-- Grant permissions to authenticator role (used by PostgREST)
DO $$
BEGIN
    -- Authenticator role
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
        GRANT USAGE ON SCHEMA public TO authenticator;
        RAISE NOTICE 'Granted USAGE to authenticator';
    ELSE
        RAISE NOTICE 'Role authenticator does not exist yet';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error granting authenticator permissions: %', SQLERRM;
END $$;

DO $$
BEGIN
    -- Anon role
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        GRANT USAGE ON SCHEMA public TO anon;
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
        GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
        RAISE NOTICE 'Granted permissions to anon';
    ELSE
        RAISE NOTICE 'Role anon does not exist yet';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error granting anon permissions: %', SQLERRM;
END $$;

DO $$
BEGIN
    -- Authenticated role
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT USAGE ON SCHEMA public TO authenticated;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
        RAISE NOTICE 'Granted permissions to authenticated';
    ELSE
        RAISE NOTICE 'Role authenticated does not exist yet';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error granting authenticated permissions: %', SQLERRM;
END $$;

DO $$
BEGIN
    -- Service role
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT USAGE ON SCHEMA public TO service_role;
        GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
        RAISE NOTICE 'Granted permissions to service_role';
    ELSE
        RAISE NOTICE 'Role service_role does not exist yet';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error granting service_role permissions: %', SQLERRM;
END $$;

-- Set default privileges for future tables
-- These need to be run for each role separately to handle missing roles gracefully
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO anon;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error setting default privileges for anon: %', SQLERRM;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error setting default privileges for authenticated: %', SQLERRM;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error setting default privileges for service_role: %', SQLERRM;
END $$;
