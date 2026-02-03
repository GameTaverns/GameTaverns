-- Recreate the trigger function with explicit search_path and ensure it can bypass RLS
CREATE OR REPLACE FUNCTION public.create_library_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.library_settings (library_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$;

-- Grant the function owner (postgres) direct INSERT on library_settings to bypass RLS
GRANT INSERT ON public.library_settings TO postgres;

-- Ensure the authenticated role can use the function indirectly through the trigger
ALTER FUNCTION public.create_library_settings() OWNER TO postgres;