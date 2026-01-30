-- =============================================================================
-- GameTaverns Self-Hosted: Auth Trigger Setup
-- This creates the trigger on auth.users to auto-create profiles
-- Must be run after the Supabase auth schema is initialized
-- =============================================================================

-- Create trigger on auth.users to auto-create user profiles
-- This runs as superuser through the Supabase PostgreSQL image
DO $$
BEGIN
    -- Check if auth schema exists first
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
        -- Drop existing trigger if it exists (for clean re-runs)
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
        
        -- Create the trigger
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW
            EXECUTE FUNCTION public.create_user_profile();
            
        RAISE NOTICE 'Auth trigger on_auth_user_created created successfully';
    ELSE
        RAISE NOTICE 'Auth schema does not exist yet - trigger will be created when auth initializes';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create auth trigger: %', SQLERRM;
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
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not grant permissions to supabase_auth_admin: %', SQLERRM;
END $$;

-- Grant permissions to authenticator role (used by PostgREST)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
        GRANT USAGE ON SCHEMA public TO authenticator;
        RAISE NOTICE 'Granted USAGE to authenticator';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        GRANT USAGE ON SCHEMA public TO anon;
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
        GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
        RAISE NOTICE 'Granted permissions to anon';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT USAGE ON SCHEMA public TO authenticated;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
        RAISE NOTICE 'Granted permissions to authenticated';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT USAGE ON SCHEMA public TO service_role;
        GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
        RAISE NOTICE 'Granted permissions to service_role';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error granting role permissions: %', SQLERRM;
END $$;

-- Set default privileges for future tables (these are safe even if roles don't exist)
DO $$
BEGIN
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;

    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error setting default privileges: %', SQLERRM;
END $$;
