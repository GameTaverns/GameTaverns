-- =============================================================================
-- GameTaverns Self-Hosted: Achievement Sync (Parity with Lovable Cloud)
-- Version: 2.4.0
-- Description: Adds 10 missing achievements (forum/community) to match Cloud's 28 total
-- =============================================================================

-- Delete old achievements that had different slugs (cleanup from earlier versions)
DELETE FROM public.achievements WHERE slug IN ('social_10_sessions', 'social_50_sessions', 'long_sessions_10');

-- Insert the complete set of 28 achievements (uses ON CONFLICT to skip existing)
INSERT INTO public.achievements (slug, name, description, category, icon, points, tier, requirement_type, requirement_value, is_secret) VALUES
    -- Collector achievements (5)
    ('first_game', 'First Acquisition', 'Add your first game to your library', 'collector', '🎲', 10, 1, 'games_owned', 1, false),
    ('collector_10', 'Growing Collection', 'Own 10 games in your library', 'collector', '📦', 25, 1, 'games_owned', 10, false),
    ('collector_50', 'Serious Collector', 'Own 50 games in your library', 'collector', '🏆', 50, 2, 'games_owned', 50, false),
    ('collector_100', 'Game Hoarder', 'Own 100 games in your library', 'collector', '👑', 100, 3, 'games_owned', 100, false),
    ('collector_500', 'Legendary Vault', 'Own 500 games in your library', 'collector', '🏰', 500, 4, 'games_owned', 500, false),
    
    -- Player achievements (4)
    ('first_play', 'Game Night Begins', 'Log your first play session', 'player', '🎯', 10, 1, 'sessions_logged', 1, false),
    ('player_10', 'Regular Player', 'Log 10 play sessions', 'player', '🎮', 25, 1, 'sessions_logged', 10, false),
    ('player_50', 'Dedicated Gamer', 'Log 50 play sessions', 'player', '⭐', 50, 2, 'sessions_logged', 50, false),
    ('player_100', 'Veteran Player', 'Log 100 play sessions', 'player', '🌟', 100, 3, 'sessions_logged', 100, false),
    
    -- Social achievements (12) - NEW FORUM ACHIEVEMENTS ADDED
    ('first_follower', 'Making Friends', 'Gain your first library follower', 'social', '👋', 10, 1, 'followers_gained', 1, false),
    ('first-post', 'First Post', 'Create your first forum thread', 'social', '✏️', 10, 1, 'threads_created', 1, false),
    ('first-reply', 'First Reply', 'Post your first forum reply', 'social', '💭', 10, 1, 'replies_created', 1, false),
    ('social-gamer', 'Social Gamer', 'Join 3 different libraries', 'social', '🎲', 25, 2, 'libraries_joined', 3, false),
    ('discussion-starter', 'Discussion Starter', 'Create 5 forum threads', 'social', '💬', 25, 2, 'threads_created', 5, false),
    ('conversation-starter', 'Conversation Starter', 'Receive 10 replies on your threads', 'social', '🔥', 30, 2, 'thread_replies_received', 10, false),
    ('helpful-contributor', 'Helpful Contributor', 'Post 10 forum replies', 'social', '🤝', 25, 2, 'replies_created', 10, false),
    ('popular_10', 'Rising Star', 'Gain 10 library followers', 'social', '⭐', 25, 2, 'followers_gained', 10, false),
    ('community-explorer', 'Community Explorer', 'Be active in 5 library forums', 'social', '🌍', 50, 3, 'library_forums_active', 5, false),
    ('hot-topic', 'Hot Topic', 'Receive 25 replies on your threads', 'social', '⭐', 75, 3, 'thread_replies_received', 25, false),
    ('prolific-poster', 'Prolific Poster', 'Create 25 forum threads', 'social', '📝', 75, 3, 'threads_created', 25, false),
    ('popular_50', 'Community Favorite', 'Gain 50 library followers', 'social', '🌟', 75, 3, 'followers_gained', 50, false),
    ('community-pillar', 'Community Pillar', 'Post 100 forum replies', 'social', '🏛️', 150, 4, 'replies_created', 100, false),
    
    -- Explorer achievements (3)
    ('first_wishlist', 'Window Shopping', 'Add a game to your wishlist', 'explorer', '💭', 5, 1, 'wishlist_votes', 1, false),
    ('first_rating', 'Critic', 'Rate your first game', 'explorer', '⭐', 5, 1, 'ratings_given', 1, false),
    ('explorer_variety', 'Genre Explorer', 'Play games from 5 different types', 'explorer', '🗺️', 30, 2, 'unique_game_types', 5, false),
    
    -- Lender achievements (3)
    ('first_loan', 'Generous Host', 'Lend a game for the first time', 'lender', '🤝', 15, 1, 'loans_completed', 1, false),
    ('lender_10', 'Community Pillar', 'Complete 10 game loans', 'lender', '💫', 50, 2, 'loans_completed', 10, false),
    ('lender_50', 'Library Legend', 'Complete 50 game loans', 'lender', '🌍', 150, 3, 'loans_completed', 50, false)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    icon = EXCLUDED.icon,
    points = EXCLUDED.points,
    tier = EXCLUDED.tier,
    requirement_type = EXCLUDED.requirement_type,
    requirement_value = EXCLUDED.requirement_value,
    is_secret = EXCLUDED.is_secret;

-- Verify count
DO $$
DECLARE
    cnt INT;
BEGIN
    SELECT count(*) INTO cnt FROM public.achievements;
    IF cnt <> 28 THEN
        RAISE WARNING 'Expected 28 achievements, found %', cnt;
    ELSE
        RAISE NOTICE 'Achievement sync complete: 28 records';
    END IF;
END $$;
