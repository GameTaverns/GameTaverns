-- Fix: Recreate games_public view WITHOUT security_invoker
-- This allows public users to access the view while the view itself controls column visibility
-- The base table remains protected by RLS (admin-only)

DROP VIEW IF EXISTS public.games_public;

CREATE VIEW public.games_public AS
  SELECT 
    id,
    title,
    slug,
    description,
    image_url,
    additional_images,
    min_players,
    max_players,
    play_time,
    difficulty,
    game_type,
    publisher_id,
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
    youtube_videos,
    suggested_age,
    bgg_id,
    bgg_url,
    location_room,
    location_shelf,
    created_at,
    updated_at
  FROM public.games;
-- Note: This intentionally EXCLUDES purchase_date and purchase_price for privacy