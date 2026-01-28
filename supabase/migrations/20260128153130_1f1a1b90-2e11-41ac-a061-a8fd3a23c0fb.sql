-- Drop existing storage policies
DROP POLICY IF EXISTS "Library owners can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Library owners can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Library owners can delete logos" ON storage.objects;

-- Recreate with corrected folder path check
-- The path format is: {library_id}/logo.{ext}
CREATE POLICY "Library owners can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'library-logos' 
  AND EXISTS (
    SELECT 1 FROM public.libraries 
    WHERE libraries.owner_id = auth.uid() 
    AND libraries.id::text = split_part(name, '/', 1)
  )
);

CREATE POLICY "Library owners can update logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'library-logos' 
  AND EXISTS (
    SELECT 1 FROM public.libraries 
    WHERE libraries.owner_id = auth.uid() 
    AND libraries.id::text = split_part(name, '/', 1)
  )
);

CREATE POLICY "Library owners can delete logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'library-logos' 
  AND EXISTS (
    SELECT 1 FROM public.libraries 
    WHERE libraries.owner_id = auth.uid() 
    AND libraries.id::text = split_part(name, '/', 1)
  )
);