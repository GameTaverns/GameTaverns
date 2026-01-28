-- Create storage bucket for library logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'library-logos',
  'library-logos',
  true,
  2097152, -- 2MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
);

-- Allow anyone to view logos (public bucket)
CREATE POLICY "Anyone can view library logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'library-logos');

-- Allow library owners to upload their logo
CREATE POLICY "Library owners can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'library-logos' 
  AND EXISTS (
    SELECT 1 FROM public.libraries 
    WHERE libraries.owner_id = auth.uid() 
    AND libraries.id::text = (storage.foldername(name))[1]
  )
);

-- Allow library owners to update their logo
CREATE POLICY "Library owners can update logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'library-logos' 
  AND EXISTS (
    SELECT 1 FROM public.libraries 
    WHERE libraries.owner_id = auth.uid() 
    AND libraries.id::text = (storage.foldername(name))[1]
  )
);

-- Allow library owners to delete their logo
CREATE POLICY "Library owners can delete logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'library-logos' 
  AND EXISTS (
    SELECT 1 FROM public.libraries 
    WHERE libraries.owner_id = auth.uid() 
    AND libraries.id::text = (storage.foldername(name))[1]
  )
);