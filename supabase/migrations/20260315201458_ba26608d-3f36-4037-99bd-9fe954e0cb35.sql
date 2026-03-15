
CREATE OR REPLACE FUNCTION public.apply_catalog_image(_catalog_id UUID, _file_path TEXT, _storage_bucket TEXT DEFAULT 'catalog-image-submissions')
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

  UPDATE public.game_catalog
  SET image_url = _public_url
  WHERE id = _catalog_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catalog entry not found: %', _catalog_id;
  END IF;

  RETURN _public_url;
END;
$$;
