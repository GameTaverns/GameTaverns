-- =====================
-- Shelf of Shame Achievements
-- =====================

-- Shame Slayer achievements (play previously unplayed games)
INSERT INTO public.achievements (slug, name, description, category, icon, points, tier, requirement_type, requirement_value, is_secret)
VALUES
  ('shame_slayer_1', 'Shame Slayer', 'Play 1 game from your Shelf of Shame', 'player', '🔥', 10, 1, 'shame_games_played', 1, false),
  ('shame_slayer_5', 'Shame Crusher', 'Play 5 games from your Shelf of Shame', 'player', '🔥', 25, 2, 'shame_games_played', 5, false),
  ('shame_slayer_10', 'Shame Destroyer', 'Play 10 games from your Shelf of Shame', 'player', '💀', 50, 3, 'shame_games_played', 10, false),
  ('shame_slayer_25', 'Shame Annihilator', 'Play 25 games from your Shelf of Shame — legendary!', 'player', '👑', 100, 4, 'shame_games_played', 25, false)
ON CONFLICT (slug) DO NOTHING;

-- Zero Shame achievements (have no unplayed games)
INSERT INTO public.achievements (slug, name, description, category, icon, points, tier, requirement_type, requirement_value, is_secret)
VALUES
  ('zero_shame', 'Zero Shame', 'Have no unplayed games in your library — impossible!', 'collector', '✨', 75, 4, 'zero_shame', 1, true)
ON CONFLICT (slug) DO NOTHING;

-- Tour completion achievement
INSERT INTO public.achievements (slug, name, description, category, icon, points, tier, requirement_type, requirement_value, is_secret)
VALUES
  ('tour_complete', 'Welcome Aboard!', 'Complete the guided onboarding tour', 'explorer', '🗺️', 15, 1, 'tour_complete', 1, false)
ON CONFLICT (slug) DO NOTHING;
