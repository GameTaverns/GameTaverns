
DROP POLICY "Library owners can upload logos" ON storage.objects;

CREATE POLICY "Library owners can upload logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'library-logos'
    AND EXISTS (
      SELECT 1 FROM public.libraries
      WHERE owner_id = auth.uid()
        AND id::text = split_part(objects.name, '/', 1)
    )
  );
