-- Add profile theme fields to public_user_profiles view
DROP VIEW IF EXISTS public.public_user_profiles;

CREATE VIEW public.public_user_profiles AS
SELECT up.user_id,
    up.username,
    up.display_name,
    up.avatar_url,
    up.bio,
    up.featured_achievement_id,
    up.banner_url,
    up.banner_gradient,
    -- Profile theme fields
    up.profile_primary_h,
    up.profile_primary_s,
    up.profile_primary_l,
    up.profile_accent_h,
    up.profile_accent_s,
    up.profile_accent_l,
    up.profile_background_h,
    up.profile_background_s,
    up.profile_background_l,
    up.profile_bg_image_url,
    up.profile_bg_opacity,
    up.created_at AS member_since,
    COALESCE(game_stats.games_owned, 0::bigint) AS games_owned,
    COALESCE(game_stats.expansions_owned, 0::bigint) AS expansions_owned,
    COALESCE(session_stats.sessions_logged, 0::bigint) AS sessions_logged,
    COALESCE(achievement_stats.achievements_earned, 0::bigint) AS achievements_earned,
    COALESCE(achievement_stats.achievement_points, 0::bigint) AS achievement_points
   FROM user_profiles up
     LEFT JOIN LATERAL ( SELECT count(*) FILTER (WHERE NOT g.is_expansion) AS games_owned,
            count(*) FILTER (WHERE g.is_expansion) AS expansions_owned
           FROM games g
             JOIN libraries l ON l.id = g.library_id
          WHERE l.owner_id = up.user_id AND l.is_active = true) game_stats ON true
     LEFT JOIN LATERAL ( SELECT count(*) AS sessions_logged
           FROM game_sessions gs
             JOIN games g ON g.id = gs.game_id
             JOIN libraries l ON l.id = g.library_id
          WHERE l.owner_id = up.user_id) session_stats ON true
     LEFT JOIN LATERAL ( SELECT count(*) AS achievements_earned,
            COALESCE(sum(a.points), 0::bigint) AS achievement_points
           FROM user_achievements ua
             JOIN achievements a ON a.id = ua.achievement_id
          WHERE ua.user_id = up.user_id) achievement_stats ON true
  WHERE up.username IS NOT NULL;

GRANT SELECT ON public.public_user_profiles TO anon, authenticated;
