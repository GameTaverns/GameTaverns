-- Fix storage.objects policies for library-logos: correctly reference storage.objects.name

-- Drop broken policies
DROP POLICY IF EXISTS "Library owners can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Library owners can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Library owners can delete logos" ON storage.objects;

-- Recreate policies (path format: {library_id}/logo.{ext})
CREATE POLICY "Library owners can upload logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'library-logos'
  AND EXISTS (
    SELECT 1
    FROM public.libraries
    WHERE libraries.owner_id = auth.uid()
      AND libraries.id::text = split_part(storage.objects.name, '/', 1)
  )
);

CREATE POLICY "Library owners can update logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'library-logos'
  AND EXISTS (
    SELECT 1
    FROM public.libraries
    WHERE libraries.owner_id = auth.uid()
      AND libraries.id::text = split_part(storage.objects.name, '/', 1)
  )
)
WITH CHECK (
  bucket_id = 'library-logos'
  AND EXISTS (
    SELECT 1
    FROM public.libraries
    WHERE libraries.owner_id = auth.uid()
      AND libraries.id::text = split_part(storage.objects.name, '/', 1)
  )
);

CREATE POLICY "Library owners can delete logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'library-logos'
  AND EXISTS (
    SELECT 1
    FROM public.libraries
    WHERE libraries.owner_id = auth.uid()
      AND libraries.id::text = split_part(storage.objects.name, '/', 1)
  )
);
