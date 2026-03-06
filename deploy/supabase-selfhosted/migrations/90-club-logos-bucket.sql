-- Migration 90: Create club-logos storage bucket
-- Version: 2.6.0

INSERT INTO storage.buckets (id, name, public)
VALUES ('club-logos', 'club-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view club logos (public bucket)
DO $$ BEGIN
  CREATE POLICY "Club logos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'club-logos');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow club owners to upload logos (folder = club_id)
DO $$ BEGIN
  CREATE POLICY "Club owners can upload logos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'club-logos'
    AND EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id::text = (storage.foldername(name))[1]
      AND owner_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow club owners to update logos
DO $$ BEGIN
  CREATE POLICY "Club owners can update logos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'club-logos'
    AND EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id::text = (storage.foldername(name))[1]
      AND owner_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow club owners to delete logos
DO $$ BEGIN
  CREATE POLICY "Club owners can delete logos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'club-logos'
    AND EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id::text = (storage.foldername(name))[1]
      AND owner_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
