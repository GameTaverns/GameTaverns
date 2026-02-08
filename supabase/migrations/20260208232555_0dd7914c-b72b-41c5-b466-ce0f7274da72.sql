
-- Fix the create_library_settings trigger to handle duplicates gracefully
CREATE OR REPLACE FUNCTION public.create_library_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.library_settings (library_id)
    VALUES (NEW.id)
    ON CONFLICT (library_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.create_library_settings() IS 'Automatically creates library_settings row when a library is created, with idempotent handling';
