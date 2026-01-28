-- Create a view for library owners that excludes sensitive tracking data
-- This protects visitor privacy while still allowing rating statistics access

CREATE OR REPLACE VIEW public.game_ratings_library_view
WITH (security_invoker = true)
AS
SELECT 
    id,
    game_id,
    guest_identifier,
    rating,
    created_at,
    updated_at
    -- Intentionally excludes: ip_address, device_fingerprint
FROM public.game_ratings;

-- Grant access to the view
GRANT SELECT ON public.game_ratings_library_view TO authenticated;

-- Add comment explaining the view's purpose
COMMENT ON VIEW public.game_ratings_library_view IS 'Privacy-safe view of game ratings for library owners. Excludes ip_address and device_fingerprint to protect visitor privacy while allowing rating access.';

-- Drop the existing library owner policy on game_ratings
DROP POLICY IF EXISTS "Library owners can view their game ratings" ON public.game_ratings;

-- Create a more restrictive policy - library owners should use the view instead
-- Keep admin access to full table for fraud investigation
-- The existing "Admins can view all ratings" policy remains unchanged