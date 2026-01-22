-- Recreate games_public view with security_definer to bypass RLS
-- This is safe because the view only exposes non-sensitive columns
DROP VIEW IF EXISTS public.games_public;

CREATE VIEW public.games_public
WITH (security_barrier = true) AS
SELECT 
    id,
    title,
    slug,
    description,
    image_url,
    additional_images,
    youtube_videos,
    bgg_id,
    bgg_url,
    min_players,
    max_players,
    play_time,
    difficulty,
    game_type,
    publisher_id,
    suggested_age,
    is_coming_soon,
    is_for_sale,
    sale_price,
    sale_condition,
    is_expansion,
    parent_game_id,
    in_base_game_box,
    sleeved,
    upgraded_components,
    crowdfunded,
    inserts,
    location_room,
    location_shelf,
    location_misc,
    created_at,
    updated_at
FROM games;

-- Grant SELECT on the view to anon and authenticated roles
GRANT SELECT ON public.games_public TO anon, authenticated;