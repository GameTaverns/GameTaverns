-- =============================================================================
-- GameTaverns Self-Hosted: Seed Data
-- Version: 2.3.2 - Schema Parity Audit
-- =============================================================================

-- ===========================================
-- Default Achievements (matching Lovable Cloud schema)
-- ===========================================
INSERT INTO public.achievements (slug, name, description, category, icon, points, tier, requirement_type, requirement_value, is_secret) VALUES
    -- Collector achievements
    ('first_game', 'First Acquisition', 'Add your first game to your library', 'collector', '🎲', 10, 1, 'games_owned', 1, false),
    ('collector_10', 'Growing Collection', 'Own 10 games in your library', 'collector', '📦', 25, 1, 'games_owned', 10, false),
    ('collector_50', 'Serious Collector', 'Own 50 games in your library', 'collector', '🏆', 50, 2, 'games_owned', 50, false),
    ('collector_100', 'Game Hoarder', 'Own 100 games in your library', 'collector', '👑', 100, 3, 'games_owned', 100, false),
    ('collector_500', 'Legendary Vault', 'Own 500 games in your library', 'collector', '🏰', 500, 4, 'games_owned', 500, false),
    
    -- Player achievements
    ('first_play', 'Game Night Begins', 'Log your first play session', 'player', '🎯', 10, 1, 'sessions_logged', 1, false),
    ('player_10', 'Regular Player', 'Log 10 play sessions', 'player', '🎮', 25, 1, 'sessions_logged', 10, false),
    ('player_50', 'Dedicated Gamer', 'Log 50 play sessions', 'player', '⭐', 50, 2, 'sessions_logged', 50, false),
    ('player_100', 'Veteran Player', 'Log 100 play sessions', 'player', '🌟', 100, 3, 'sessions_logged', 100, false),
    
    -- Social achievements
    ('first_follower', 'Making Friends', 'Gain your first library follower', 'social', '👋', 10, 1, 'followers_gained', 1, false),
    ('popular_10', 'Rising Star', 'Gain 10 library followers', 'social', '⭐', 25, 2, 'followers_gained', 10, false),
    ('popular_50', 'Community Favorite', 'Gain 50 library followers', 'social', '🌟', 75, 3, 'followers_gained', 50, false),
    
    -- Explorer achievements
    ('first_wishlist', 'Window Shopping', 'Add a game to your wishlist', 'explorer', '💭', 5, 1, 'wishlist_votes', 1, false),
    ('first_rating', 'Critic', 'Rate your first game', 'explorer', '⭐', 5, 1, 'ratings_given', 1, false),
    ('explorer_variety', 'Genre Explorer', 'Play games from 5 different types', 'explorer', '🗺️', 30, 2, 'unique_game_types', 5, false),
    
    -- Lender achievements
    ('first_loan', 'Generous Host', 'Lend a game for the first time', 'lender', '🤝', 15, 1, 'loans_completed', 1, false),
    ('lender_10', 'Community Pillar', 'Complete 10 game loans', 'lender', '💫', 50, 2, 'loans_completed', 10, false),
    ('lender_50', 'Library Legend', 'Complete 50 game loans', 'lender', '🌍', 150, 3, 'loans_completed', 50, false)
ON CONFLICT (slug) DO NOTHING;

-- ===========================================
-- Default Mechanics
-- ===========================================
INSERT INTO public.mechanics (name) VALUES
    ('Area Control'),
    ('Auction'),
    ('Bluffing'),
    ('Card Drafting'),
    ('Cooperative'),
    ('Deck Building'),
    ('Dice Rolling'),
    ('Engine Building'),
    ('Hand Management'),
    ('Network Building'),
    ('Player Elimination'),
    ('Push Your Luck'),
    ('Resource Management'),
    ('Roll and Write'),
    ('Route Building'),
    ('Set Collection'),
    ('Tile Placement'),
    ('Trading'),
    ('Variable Player Powers'),
    ('Worker Placement')
ON CONFLICT (name) DO NOTHING;
