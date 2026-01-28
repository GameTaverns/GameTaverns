-- Set database timezone to Eastern Time (UTC-5/UTC-4 with DST)
ALTER DATABASE postgres SET timezone TO 'America/New_York';

-- Also set for current session and future connections
SET timezone TO 'America/New_York';

-- Create a function to ensure timezone is set on new connections
CREATE OR REPLACE FUNCTION public.set_timezone()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SET timezone TO 'America/New_York';
$$;

COMMENT ON FUNCTION public.set_timezone() IS 'Sets session timezone to Eastern Time (UTC-5)';