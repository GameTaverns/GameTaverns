
INSERT INTO public.achievements (slug, name, description, category, icon, points, tier, requirement_type, requirement_value, is_secret)
VALUES
  ('tour_complete', 'Welcome Aboard!', 'Complete the guided onboarding tour', 'explorer', '🗺️', 15, 1, 'tour_complete', 1, false)
ON CONFLICT (slug) DO NOTHING;
