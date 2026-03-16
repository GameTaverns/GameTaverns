-- =============================================================================
-- GameTaverns Self-Hosted: Seed Data
-- Version: 2.5.0 - Achievement Overhaul
-- =============================================================================

-- ===========================================
-- Default Achievements (39 total)
-- ===========================================
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
    
    -- Social achievements (11: 3 follower + 8 referral)
    ('first_follower', 'Making Friends', 'Gain your first library follower', 'social', '👋', 10, 1, 'followers_gained', 1, false),
    ('popular_10', 'Rising Star', 'Gain 10 library followers', 'social', '⭐', 25, 2, 'followers_gained', 10, false),
    ('popular_50', 'Community Favorite', 'Gain 50 library followers', 'social', '🌟', 75, 3, 'followers_gained', 50, false),
    ('referral_1', 'First Recruit', 'Refer your first person to GameTaverns', 'social', '👋', 10, 1, 'referrals_completed', 1, false),
    ('referral_3', 'Word Spreader', 'Refer 3 people to GameTaverns', 'social', '📢', 20, 1, 'referrals_completed', 3, false),
    ('referral_5', 'Town Crier', 'Refer 5 people to GameTaverns', 'social', '📣', 30, 1, 'referrals_completed', 5, false),
    ('referral_10', 'Recruiter', 'Refer 10 people to GameTaverns', 'social', '🎯', 50, 2, 'referrals_completed', 10, false),
    ('referral_15', 'Guild Recruiter', 'Refer 15 people to GameTaverns', 'social', '⚔️', 75, 2, 'referrals_completed', 15, false),
    ('referral_25', 'Ambassador', 'Refer 25 people to GameTaverns', 'social', '🏅', 100, 3, 'referrals_completed', 25, false),
    ('referral_50', 'Legend Maker', 'Refer 50 people to GameTaverns', 'social', '👑', 200, 3, 'referrals_completed', 50, false),
    ('referral_100', 'Grand Champion', 'Refer 100 people to GameTaverns', 'social', '🏆', 500, 4, 'referrals_completed', 100, false),
    
    -- Explorer achievements (3)
    ('first_wishlist', 'Window Shopping', 'Add a game to your wishlist', 'explorer', '💭', 5, 1, 'wishlist_votes', 1, false),
    ('first_rating', 'Critic', 'Rate your first game', 'explorer', '⭐', 5, 1, 'ratings_given', 1, false),
    ('explorer_variety', 'Genre Explorer', 'Play games from 5 different types', 'explorer', '🗺️', 30, 2, 'unique_game_types', 5, false),
    
    -- Lender achievements (3)
    ('first_loan', 'Generous Host', 'Lend a game for the first time', 'lender', '🤝', 15, 1, 'loans_completed', 1, false),
    ('lender_10', 'Community Pillar', 'Complete 10 game loans', 'lender', '💫', 50, 2, 'loans_completed', 10, false),
    ('lender_50', 'Library Legend', 'Complete 50 game loans', 'lender', '🌍', 150, 3, 'loans_completed', 50, false),
    
    -- Contributor: Photo uploads (9)
    ('photos_1', 'Shutterbug', 'Upload your first game photo', 'contributor', '📸', 10, 1, 'photos_uploaded', 1, false),
    ('photos_3', 'Snapshot Collector', 'Upload 3 game photos', 'contributor', '📷', 15, 1, 'photos_uploaded', 3, false),
    ('photos_10', 'Photo Enthusiast', 'Upload 10 game photos', 'contributor', '🖼️', 25, 1, 'photos_uploaded', 10, false),
    ('photos_25', 'Gallery Curator', 'Upload 25 game photos', 'contributor', '🎨', 50, 2, 'photos_uploaded', 25, false),
    ('photos_50', 'Photo Pro', 'Upload 50 game photos', 'contributor', '📸', 75, 2, 'photos_uploaded', 50, false),
    ('photos_100', 'Centurion Photographer', 'Upload 100 game photos', 'contributor', '🌟', 100, 3, 'photos_uploaded', 100, false),
    ('photos_250', 'Photo Legend', 'Upload 250 game photos', 'contributor', '⭐', 200, 3, 'photos_uploaded', 250, false),
    ('photos_500', 'Master Photographer', 'Upload 500 game photos', 'contributor', '👑', 350, 4, 'photos_uploaded', 500, false),
    ('photos_1000', 'Hall of Fame Photographer', 'Upload 1000 game photos', 'contributor', '🏆', 500, 4, 'photos_uploaded', 1000, false),
    
    -- Contributor: Document/instruction book uploads (8)
    ('docs_1', 'Rule Reader', 'Upload your first instruction book', 'contributor', '📖', 10, 1, 'docs_uploaded', 1, false),
    ('docs_3', 'Manual Collector', 'Upload 3 instruction books', 'contributor', '📚', 15, 1, 'docs_uploaded', 3, false),
    ('docs_5', 'Documentation Helper', 'Upload 5 instruction books', 'contributor', '📝', 25, 1, 'docs_uploaded', 5, false),
    ('docs_10', 'Library Scribe', 'Upload 10 instruction books', 'contributor', '✍️', 50, 2, 'docs_uploaded', 10, false),
    ('docs_25', 'Knowledge Keeper', 'Upload 25 instruction books', 'contributor', '📜', 75, 2, 'docs_uploaded', 25, false),
    ('docs_50', 'Archive Builder', 'Upload 50 instruction books', 'contributor', '🏛️', 100, 3, 'docs_uploaded', 50, false),
    ('docs_100', 'Loremaster', 'Upload 100 instruction books', 'contributor', '🧙', 200, 3, 'docs_uploaded', 100, false),
    ('docs_250', 'Grand Archivist', 'Upload 250 instruction books', 'contributor', '👑', 350, 4, 'docs_uploaded', 250, false),
    
    -- Contributor: Catalog image submissions (6)
    ('catalog_img_1', 'Box Art Scout', 'Submit your first catalog image', 'contributor', '🖼️', 10, 1, 'catalog_images_submitted', 1, false),
    ('catalog_img_3', 'Art Contributor', 'Submit 3 catalog images', 'contributor', '🎨', 15, 1, 'catalog_images_submitted', 3, false),
    ('catalog_img_10', 'Visual Curator', 'Submit 10 catalog images', 'contributor', '📸', 30, 2, 'catalog_images_submitted', 10, false),
    ('catalog_img_25', 'Gallery Builder', 'Submit 25 catalog images', 'contributor', '🌟', 50, 2, 'catalog_images_submitted', 25, false),
    ('catalog_img_50', 'Art Director', 'Submit 50 catalog images', 'contributor', '⭐', 100, 3, 'catalog_images_submitted', 50, false),
    ('catalog_img_100', 'Visual Legend', 'Submit 100 catalog images', 'contributor', '👑', 200, 4, 'catalog_images_submitted', 100, false)
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
