-- =============================================================================
-- GameTaverns Self-Hosted: Public Views (for unauthenticated access)
-- =============================================================================

-- ===========================================
-- Public Libraries View (strips sensitive data)
-- ===========================================
CREATE OR REPLACE VIEW public.libraries_public AS
SELECT 
    id,
    slug,
    name,
    description,
    custom_domain,
    is_active,
    is_premium,
    created_at,
    updated_at
FROM public.libraries
WHERE is_active = true;

-- ===========================================
-- Public Library Settings View
-- ===========================================
CREATE OR REPLACE VIEW public.library_settings_public AS
SELECT 
    ls.library_id,
    ls.logo_url,
    ls.background_image_url,
    ls.background_overlay_opacity,
    ls.footer_text,
    ls.contact_email,
    ls.twitter_handle,
    ls.instagram_url,
    ls.facebook_url,
    ls.discord_url,
    ls.feature_ratings,
    ls.feature_wishlist,
    ls.feature_for_sale,
    ls.feature_messaging,
    ls.feature_lending,
    ls.feature_achievements,
    ls.feature_events,
    ls.feature_play_logs,
    ls.feature_coming_soon,
    ls.theme_primary_h,
    ls.theme_primary_s,
    ls.theme_primary_l,
    ls.theme_accent_h,
    ls.theme_accent_s,
    ls.theme_accent_l,
    ls.theme_background_h,
    ls.theme_background_s,
    ls.theme_background_l,
    ls.theme_card_h,
    ls.theme_card_s,
    ls.theme_card_l,
    ls.theme_sidebar_h,
    ls.theme_sidebar_s,
    ls.theme_sidebar_l,
    ls.theme_dark_primary_h,
    ls.theme_dark_primary_s,
    ls.theme_dark_primary_l,
    ls.theme_dark_accent_h,
    ls.theme_dark_accent_s,
    ls.theme_dark_accent_l,
    ls.theme_dark_background_h,
    ls.theme_dark_background_s,
    ls.theme_dark_background_l,
    ls.theme_dark_card_h,
    ls.theme_dark_card_s,
    ls.theme_dark_card_l,
    ls.theme_dark_sidebar_h,
    ls.theme_dark_sidebar_s,
    ls.theme_dark_sidebar_l,
    ls.theme_font_display,
    ls.theme_font_body,
    ls.created_at,
    ls.updated_at
FROM public.library_settings ls
JOIN public.libraries l ON l.id = ls.library_id
WHERE l.is_active = true;

-- ===========================================
-- Public Games View (strips private data)
-- ===========================================
CREATE OR REPLACE VIEW public.games_public AS
SELECT 
    g.id,
    g.library_id,
    g.title,
    g.slug,
    g.description,
    g.image_url,
    g.additional_images,
    g.min_players,
    g.max_players,
    g.play_time,
    g.difficulty,
    g.game_type,
    g.suggested_age,
    g.bgg_id,
    g.bgg_url,
    g.publisher_id,
    g.is_expansion,
    g.parent_game_id,
    g.is_for_sale,
    g.is_coming_soon,
    g.sale_price,
    g.sale_condition,
    g.sleeved,
    g.inserts,
    g.upgraded_components,
    g.crowdfunded,
    g.in_base_game_box,
    g.location_room,
    g.location_shelf,
    g.location_misc,
    g.youtube_videos,
    g.created_at,
    g.updated_at
FROM public.games g
JOIN public.libraries l ON l.id = g.library_id
WHERE l.is_active = true;

-- ===========================================
-- Public User Profiles View (strips user_id)
-- ===========================================
CREATE OR REPLACE VIEW public.user_profiles_public AS
SELECT 
    id,
    display_name,
    username,
    avatar_url,
    bio,
    created_at
FROM public.user_profiles;

-- ===========================================
-- Library Directory View (for discovery)
-- ===========================================
CREATE OR REPLACE VIEW public.library_directory AS
SELECT 
    l.id,
    l.slug,
    l.name,
    l.description,
    ls.logo_url,
    ls.is_discoverable,
    ls.allow_lending,
    l.created_at,
    (SELECT COUNT(*) FROM public.games g WHERE g.library_id = l.id) as game_count,
    (SELECT COUNT(*) FROM public.library_members lm WHERE lm.library_id = l.id) as member_count,
    (SELECT COUNT(*) FROM public.library_followers lf WHERE lf.library_id = l.id) as follower_count
FROM public.libraries l
JOIN public.library_settings ls ON ls.library_id = l.id
WHERE l.is_active = true AND ls.is_discoverable = true;

-- ===========================================
-- Game Ratings Summary View
-- ===========================================
CREATE OR REPLACE VIEW public.game_ratings_summary AS
SELECT 
    game_id,
    COUNT(*)::integer as rating_count,
    ROUND(AVG(rating), 2) as average_rating
FROM public.game_ratings
GROUP BY game_id;

-- ===========================================
-- Game Wishlist Summary View
-- ===========================================
CREATE OR REPLACE VIEW public.game_wishlist_summary AS
SELECT 
    game_id,
    COUNT(*) as vote_count,
    COUNT(*) FILTER (WHERE guest_name IS NOT NULL) as named_votes
FROM public.game_wishlist
GROUP BY game_id;

-- ===========================================
-- Borrower Reputation View
-- ===========================================
CREATE OR REPLACE VIEW public.borrower_reputation AS
SELECT 
    rated_user_id as user_id,
    COUNT(*) as total_ratings,
    ROUND(AVG(rating), 2) as average_rating,
    COUNT(*) FILTER (WHERE rating >= 4) as positive_ratings
FROM public.borrower_ratings
GROUP BY rated_user_id;

-- ===========================================
-- Library Calendar Events View (combined events + polls)
-- ===========================================
CREATE OR REPLACE VIEW public.library_calendar_events AS
SELECT 
    id,
    library_id,
    title,
    description,
    event_date,
    event_location,
    NULL as share_token,
    NULL as poll_status,
    'event' as event_type,
    created_at
FROM public.library_events
UNION ALL
SELECT 
    id,
    library_id,
    title,
    description,
    event_date,
    event_location,
    share_token,
    status as poll_status,
    'game_night' as event_type,
    created_at
FROM public.game_polls
WHERE event_date IS NOT NULL;
