-- =============================================================================
-- GameTaverns Self-Hosted: Storage Permission Fixes
-- Version: 2.3.4 - Fix storage.buckets SELECT permission + explicit GRANTs
-- 
-- ISSUE: In self-hosted Supabase, the storage service queries storage.buckets
--        to get file_size_limit and allowed_mime_types BEFORE checking objects.
--        The 'authenticated' role needs explicit GRANT + RLS policy on buckets.
-- =============================================================================

-- Ensure storage schema and tables exist before proceeding
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
        RAISE NOTICE 'Storage schema not ready yet - skipping grants';
        RETURN;
    END IF;

    -- ===========================================================================
    -- CRITICAL: Grant USAGE on storage schema first
    -- ===========================================================================
    GRANT USAGE ON SCHEMA storage TO authenticated;
    GRANT USAGE ON SCHEMA storage TO anon;
    GRANT USAGE ON SCHEMA storage TO authenticator;
    GRANT USAGE ON SCHEMA storage TO service_role;

    -- ===========================================================================
    -- CRITICAL: Grant SELECT on storage.buckets to roles used by API/Storage
    -- Without this explicit GRANT, uploads fail with "42501 permission denied"
    -- even if RLS policies allow access. The GRANT is checked BEFORE RLS.
    -- ===========================================================================
    GRANT SELECT ON storage.buckets TO authenticated;
    GRANT SELECT ON storage.buckets TO anon;
    GRANT SELECT ON storage.buckets TO authenticator;
    GRANT SELECT ON storage.buckets TO service_role;
    GRANT ALL ON storage.buckets TO postgres;

    -- ===========================================================================
    -- CRITICAL: Grant permissions on storage.objects (metadata table)
    -- ===========================================================================
    GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
    GRANT SELECT ON storage.objects TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticator;
    GRANT ALL ON storage.objects TO service_role;
    GRANT ALL ON storage.objects TO postgres;

    -- ===========================================================================
    -- CRITICAL: Storage uses functions like storage.search() internally.
    -- Missing EXECUTE here surfaces as 42501 during list/upload flows.
    -- ===========================================================================
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA storage TO authenticated;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA storage TO anon;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA storage TO authenticator;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA storage TO service_role;

    RAISE NOTICE 'Granted storage schema permissions to all roles';

    -- ===========================================================================
    -- Ensure RLS is enabled and policies exist on storage.buckets
    -- ===========================================================================
    ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies to allow clean re-creation
    DROP POLICY IF EXISTS "Public bucket metadata is readable" ON storage.buckets;
    DROP POLICY IF EXISTS "Public buckets are readable by everyone" ON storage.buckets;
    
    -- Allow reading bucket metadata (required for storage service validation)
    CREATE POLICY "Public bucket metadata is readable"
    ON storage.buckets FOR SELECT
    USING (true);

    RAISE NOTICE 'Created RLS policy on storage.buckets';

    -- ===========================================================================
    -- Re-create storage.objects policies for library-logos bucket
    -- ===========================================================================
    
    -- Drop existing policies
    DROP POLICY IF EXISTS "Public logos are viewable by everyone" ON storage.objects;
    DROP POLICY IF EXISTS "Library owners can upload logos" ON storage.objects;
    DROP POLICY IF EXISTS "Library owners can update logos" ON storage.objects;
    DROP POLICY IF EXISTS "Library owners can delete logos" ON storage.objects;
    DROP POLICY IF EXISTS "Admins can manage all logos" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload to their library" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can update their library files" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can delete their library files" ON storage.objects;

    -- Public read for library-logos
    CREATE POLICY "Public logos are viewable by everyone"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'library-logos');

    -- Library owners can upload (INSERT)
    CREATE POLICY "Library owners can upload logos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'library-logos'
        AND EXISTS (
          SELECT 1 FROM public.libraries
          WHERE owner_id = auth.uid()
            AND id::text = split_part(objects.name, '/', 1)
        )
    );

    -- Library owners can update their logos
    CREATE POLICY "Library owners can update logos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'library-logos'
        AND EXISTS (
          SELECT 1 FROM public.libraries
          WHERE owner_id = auth.uid()
            AND id::text = split_part(name, '/', 1)
        )
    )
    WITH CHECK (
        bucket_id = 'library-logos'
        AND EXISTS (
          SELECT 1 FROM public.libraries
          WHERE owner_id = auth.uid()
            AND id::text = split_part(name, '/', 1)
        )
    );

    -- Library owners can delete their logos
    CREATE POLICY "Library owners can delete logos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'library-logos'
        AND EXISTS (
          SELECT 1 FROM public.libraries
          WHERE owner_id = auth.uid()
            AND id::text = split_part(name, '/', 1)
        )
    );

    RAISE NOTICE 'Created storage.objects policies for library-logos';

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Storage grants error: % (storage may not be initialized yet)', SQLERRM;
END $$;

-- ===========================================================================
-- Ensure library-logos bucket exists with correct settings
-- ===========================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'library-logos') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            'library-logos',
            'library-logos',
            true,
            5242880,
            ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
        );
        RAISE NOTICE 'Created library-logos bucket';
    ELSE
        -- Ensure it's public and has correct settings
        UPDATE storage.buckets 
        SET public = true,
            file_size_limit = 5242880,
            allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
        WHERE id = 'library-logos';
        RAISE NOTICE 'Updated library-logos bucket settings';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Bucket creation/update error: %', SQLERRM;
END $$;
