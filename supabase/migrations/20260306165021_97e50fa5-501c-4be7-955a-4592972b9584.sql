
-- Create club-logos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('club-logos', 'club-logos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Club logos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Club owners can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Club owners can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Club owners can delete logos" ON storage.objects;

-- Public read
CREATE POLICY "Club logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'club-logos');

-- Club owners can upload
CREATE POLICY "Club owners can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'club-logos'
  AND EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id::text = (storage.foldername(name))[1]
    AND owner_id = auth.uid()
  )
);

-- Club owners can update
CREATE POLICY "Club owners can update logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'club-logos'
  AND EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id::text = (storage.foldername(name))[1]
    AND owner_id = auth.uid()
  )
);

-- Club owners can delete
CREATE POLICY "Club owners can delete logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'club-logos'
  AND EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id::text = (storage.foldername(name))[1]
    AND owner_id = auth.uid()
  )
);
