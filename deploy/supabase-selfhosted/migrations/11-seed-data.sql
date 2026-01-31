-- =============================================================================
-- GameTaverns Self-Hosted: Seed Data
-- Version: 2.2.0 - 5-Tier Role Hierarchy
-- =============================================================================

-- ===========================================
-- Default Achievements
-- ===========================================
INSERT INTO public.achievements (slug, name, description, category, icon, points, tier, requirement_type, requirement_value, is_secret) VALUES
    -- Collection achievements
    ('first_game', 'First Game', 'Add your first game to the collection', 'collection', '🎮', 10, 1, 'games_added', 1, false),
    ('collector_10', 'Growing Collection', 'Add 10 games to the collection', 'collection', '📚', 25, 1, 'games_added', 10, false),
    ('collector_50', 'Serious Collector', 'Add 50 games to the collection', 'collection', '🏆', 50, 2, 'games_added', 50, false),
    ('collector_100', 'Master Collector', 'Add 100 games to the collection', 'collection', '👑', 100, 3, 'games_added', 100, false),
    ('collector_250', 'Legendary Hoarder', 'Add 250 games to the collection', 'collection', '🌟', 250, 4, 'games_added', 250, false),
    
    -- Social achievements
    ('first_member', 'Welcome!', 'Someone joined your library', 'social', '👋', 15, 1, 'members_count', 1, false),
    ('community_10', 'Community Builder', '10 members in your library', 'social', '🏘️', 50, 2, 'members_count', 10, false),
    ('community_50', 'Town Square', '50 members in your library', 'social', '🏛️', 100, 3, 'members_count', 50, false),
    
    -- Engagement achievements
    ('first_play', 'Game Night!', 'Log your first play session', 'engagement', '🎲', 10, 1, 'plays_logged', 1, false),
    ('plays_10', 'Regular Player', 'Log 10 play sessions', 'engagement', '🎯', 25, 1, 'plays_logged', 10, false),
    ('plays_50', 'Dedicated Gamer', 'Log 50 play sessions', 'engagement', '🏅', 50, 2, 'plays_logged', 50, false),
    ('first_loan', 'Sharing is Caring', 'Lend your first game', 'engagement', '🤝', 20, 1, 'loans_made', 1, false),
    ('first_event', 'Event Organizer', 'Create your first event', 'engagement', '📅', 15, 1, 'events_created', 1, false),
    
    -- Special achievements
    ('early_adopter', 'Early Adopter', 'Joined during the early days', 'special', '🌱', 100, 1, 'special', 1, true),
    ('premium_member', 'Premium Supporter', 'Upgraded to premium', 'special', '💎', 50, 1, 'special', 1, false)
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
