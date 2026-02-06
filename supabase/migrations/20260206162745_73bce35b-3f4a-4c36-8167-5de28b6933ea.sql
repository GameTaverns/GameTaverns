-- Fix the library-logos INSERT policy that was missing WITH CHECK clause
DROP POLICY IF EXISTS "Library owners can upload logos" ON storage.objects;

CREATE POLICY "Library owners can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'library-logos'
  AND EXISTS (
    SELECT 1 FROM libraries
    WHERE libraries.owner_id = auth.uid()
    AND libraries.id::text = split_part(name, '/', 1)
  )
);