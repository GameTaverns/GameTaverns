-- =============================================================================
-- GameTaverns Self-Hosted: Storage Buckets & Policies
-- Version: 2.3.2 - Schema Parity Audit
-- =============================================================================

-- First check if storage schema exists (it should be created by Supabase)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
        RAISE NOTICE 'Storage schema does not exist yet - will be created by Supabase storage service';
        RETURN;
    END IF;
    
    -- Create library-logos bucket (public)
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'library-logos',
        'library-logos',
        true,
        5242880, -- 5MB limit
        ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    )
    ON CONFLICT (id) DO UPDATE SET
        public = true,
        file_size_limit = 5242880,
        allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        
    RAISE NOTICE 'Created/updated library-logos bucket';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create storage bucket: % (will be created when storage service starts)', SQLERRM;
END $$;

-- Storage policies for library-logos bucket
-- Wrapped in DO block for safety if storage schema doesn't exist yet
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
        RAISE NOTICE 'Storage schema not ready - skipping policies';
        RETURN;
    END IF;

    -- Drop existing policies first to allow clean re-runs
    DROP POLICY IF EXISTS "Public logos are viewable by everyone" ON storage.objects;
    DROP POLICY IF EXISTS "Library owners can upload logos" ON storage.objects;
    DROP POLICY IF EXISTS "Library owners can update logos" ON storage.objects;
    DROP POLICY IF EXISTS "Library owners can delete logos" ON storage.objects;
    DROP POLICY IF EXISTS "Admins can manage all logos" ON storage.objects;

    -- Anyone can view logos (public bucket)
    CREATE POLICY "Public logos are viewable by everyone"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'library-logos');

    -- Library moderators (including owners, moderators, and staff) can upload/update/delete logos
    -- This matches the app permission model (branding changes are not necessarily owner-only).
    CREATE POLICY "Library owners can upload logos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'library-logos'
        AND public.is_library_moderator(auth.uid(), split_part(name, '/', 1)::uuid)
    );

    -- Library moderators can update their logos
    CREATE POLICY "Library owners can update logos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'library-logos'
        AND public.is_library_moderator(auth.uid(), split_part(name, '/', 1)::uuid)
    )
    WITH CHECK (
        bucket_id = 'library-logos'
        AND public.is_library_moderator(auth.uid(), split_part(name, '/', 1)::uuid)
    );

    -- Library moderators can delete their logos
    CREATE POLICY "Library owners can delete logos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'library-logos'
        AND public.is_library_moderator(auth.uid(), split_part(name, '/', 1)::uuid)
    );

    -- Admins can manage all logos
    CREATE POLICY "Admins can manage all logos"
    ON storage.objects FOR ALL
    USING (
        bucket_id = 'library-logos'
        AND public.has_role(auth.uid(), 'admin')
    );

    RAISE NOTICE 'Storage policies created successfully';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create storage policies: %', SQLERRM;
END $$;
