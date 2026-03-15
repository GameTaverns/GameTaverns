
CREATE OR REPLACE FUNCTION public.apply_catalog_image(
  _catalog_id UUID,
  _file_path TEXT,
  _storage_bucket TEXT DEFAULT 'catalog-image-submissions'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _public_url TEXT;
  _supabase_url TEXT;
BEGIN
  -- Build the public URL for the storage object
  _supabase_url := current_setting('app.settings.supabase_url', true);
  IF _supabase_url IS NULL OR _supabase_url = '' THEN
    _supabase_url := 'https://ddfslywzgddlpmkhohfu.supabase.co';
  END IF;
  
  _public_url := _supabase_url || '/storage/v1/object/public/' || _storage_bucket || '/' || _file_path;

  -- Update the catalog entry's canonical image
  UPDATE public.game_catalog
  SET image_url = _public_url, updated_at = now()
  WHERE id = _catalog_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catalog entry not found: %', _catalog_id;
  END IF;

  -- For library games linked to this catalog entry:
  -- Add the submitted image to additional_images (do NOT replace the primary image_url)
  UPDATE public.games
  SET additional_images = CASE
        WHEN additional_images IS NULL THEN ARRAY[_public_url]
        WHEN _public_url = ANY(additional_images) THEN additional_images
        ELSE array_prepend(_public_url, additional_images)
      END,
      updated_at = now()
  WHERE catalog_id = _catalog_id;

  RETURN _public_url;
END;
$$;

-- Fix Flamecraft Duals: restore original BGG image as primary, move submitted image to additional_images
WITH catalog_info AS (
  SELECT gc.id as catalog_id, gc.image_url as catalog_image
  FROM public.game_catalog gc
  WHERE gc.slug = 'flamecraft-duals'
)
UPDATE public.games g
SET image_url = COALESCE(
      -- Try to get original BGG image from catalog's bgg data or keep current if it's not the submitted one
      (SELECT gc.image_url FROM public.game_catalog gc WHERE gc.id = g.catalog_id AND gc.image_url NOT LIKE '%catalog-image-submissions%'),
      g.image_url
    ),
    additional_images = CASE
      WHEN g.image_url LIKE '%catalog-image-submissions%' 
           AND NOT (g.image_url = ANY(COALESCE(g.additional_images, '{}')))
      THEN array_prepend(g.image_url, COALESCE(g.additional_images, '{}'))
      ELSE g.additional_images
    END,
    updated_at = now()
WHERE g.catalog_id IN (SELECT catalog_id FROM catalog_info)
  AND g.image_url LIKE '%catalog-image-submissions%';
