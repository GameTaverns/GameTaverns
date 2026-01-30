-- =============================================================================
-- GameTaverns Self-Hosted: Storage Buckets & Policies
-- =============================================================================

-- Create library-logos bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'library-logos',
    'library-logos',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for library-logos bucket

-- Anyone can view logos (public bucket)
CREATE POLICY "Public logos are viewable by everyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'library-logos');

-- Library owners can upload logos
CREATE POLICY "Library owners can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'library-logos'
    AND (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.libraries WHERE owner_id = auth.uid()
    )
);

-- Library owners can update their logos
CREATE POLICY "Library owners can update logos"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'library-logos'
    AND (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.libraries WHERE owner_id = auth.uid()
    )
);

-- Library owners can delete their logos
CREATE POLICY "Library owners can delete logos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'library-logos'
    AND (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.libraries WHERE owner_id = auth.uid()
    )
);

-- Admins can manage all logos
CREATE POLICY "Admins can manage all logos"
ON storage.objects FOR ALL
USING (
    bucket_id = 'library-logos'
    AND public.has_role(auth.uid(), 'admin')
);
