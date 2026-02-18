-- Add storage policy to allow library owners to upload background images
-- The existing "Library owners can upload logos" policy already covers libraryId/* paths
-- But let's also add an explicit update policy for background images
-- and ensure the bucket allows the file size we need

-- Update library-logos bucket to allow 8MB files (was 5MB)
UPDATE storage.buckets 
SET file_size_limit = 8388608
WHERE id = 'library-logos';
