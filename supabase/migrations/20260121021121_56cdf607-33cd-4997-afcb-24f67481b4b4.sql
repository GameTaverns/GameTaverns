-- Recreate games_public view WITHOUT security_invoker (use security definer)
-- This allows the view to bypass RLS on the base table
DROP VIEW IF EXISTS public.games_public;

CREATE VIEW public.games_public AS
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
    created_at,
    updated_at
FROM games;

-- Recreate site_settings_public view WITHOUT security_invoker
DROP VIEW IF EXISTS public.site_settings_public;

CREATE VIEW public.site_settings_public AS
SELECT 
    id,
    key,
    value,
    created_at,
    updated_at
FROM site_settings
WHERE key NOT LIKE 'admin_%' 
  AND key NOT LIKE 'secret_%'
  AND key NOT IN ('smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'encryption_key');

-- Grant SELECT to anon and authenticated
GRANT SELECT ON public.games_public TO anon, authenticated;
GRANT SELECT ON public.site_settings_public TO anon, authenticated;