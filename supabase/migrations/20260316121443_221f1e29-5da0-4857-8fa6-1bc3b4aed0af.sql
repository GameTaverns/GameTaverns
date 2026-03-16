
-- =============================================================================
-- Achievement System Overhaul
-- 1) Remove all forum-related achievements (earned + definitions)
-- 2) Add photo upload achievements (9 tiers)
-- 3) Add document upload achievements (8 tiers)
-- 4) Add catalog image submission achievements (6 tiers)
-- 5) Add referral achievements (8 tiers)
-- =============================================================================

-- Step 1: Delete earned forum achievements, then the definitions
DELETE FROM public.user_achievements
WHERE achievement_id IN (
  SELECT id FROM public.achievements
  WHERE slug IN (
    'first-post', 'first-reply', 'social-gamer', 'discussion-starter',
    'conversation-starter', 'helpful-contributor', 'community-explorer',
    'hot-topic', 'prolific-poster', 'community-pillar'
  )
);

DELETE FROM public.achievements
WHERE slug IN (
  'first-post', 'first-reply', 'social-gamer', 'discussion-starter',
  'conversation-starter', 'helpful-contributor', 'community-explorer',
  'hot-topic', 'prolific-poster', 'community-pillar'
);

-- Step 2: Photo upload achievements (category: contributor)
INSERT INTO public.achievements (slug, name, description, category, icon, points, tier, requirement_type, requirement_value, is_secret) VALUES
  ('photos_1', 'Shutterbug', 'Upload your first game photo', 'contributor', '📸', 10, 1, 'photos_uploaded', 1, false),
  ('photos_3', 'Snapshot Collector', 'Upload 3 game photos', 'contributor', '📷', 15, 1, 'photos_uploaded', 3, false),
  ('photos_10', 'Photo Enthusiast', 'Upload 10 game photos', 'contributor', '🖼️', 25, 1, 'photos_uploaded', 10, false),
  ('photos_25', 'Gallery Curator', 'Upload 25 game photos', 'contributor', '🎨', 50, 2, 'photos_uploaded', 25, false),
  ('photos_50', 'Photo Pro', 'Upload 50 game photos', 'contributor', '📸', 75, 2, 'photos_uploaded', 50, false),
  ('photos_100', 'Centurion Photographer', 'Upload 100 game photos', 'contributor', '🌟', 100, 3, 'photos_uploaded', 100, false),
  ('photos_250', 'Photo Legend', 'Upload 250 game photos', 'contributor', '⭐', 200, 3, 'photos_uploaded', 250, false),
  ('photos_500', 'Master Photographer', 'Upload 500 game photos', 'contributor', '👑', 350, 4, 'photos_uploaded', 500, false),
  ('photos_1000', 'Hall of Fame Photographer', 'Upload 1000 game photos', 'contributor', '🏆', 500, 4, 'photos_uploaded', 1000, false)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category,
  icon = EXCLUDED.icon, points = EXCLUDED.points, tier = EXCLUDED.tier,
  requirement_type = EXCLUDED.requirement_type, requirement_value = EXCLUDED.requirement_value;

-- Step 3: Document/instruction book upload achievements (category: contributor)
INSERT INTO public.achievements (slug, name, description, category, icon, points, tier, requirement_type, requirement_value, is_secret) VALUES
  ('docs_1', 'Rule Reader', 'Upload your first instruction book', 'contributor', '📖', 10, 1, 'docs_uploaded', 1, false),
  ('docs_3', 'Manual Collector', 'Upload 3 instruction books', 'contributor', '📚', 15, 1, 'docs_uploaded', 3, false),
  ('docs_5', 'Documentation Helper', 'Upload 5 instruction books', 'contributor', '📝', 25, 1, 'docs_uploaded', 5, false),
  ('docs_10', 'Library Scribe', 'Upload 10 instruction books', 'contributor', '✍️', 50, 2, 'docs_uploaded', 10, false),
  ('docs_25', 'Knowledge Keeper', 'Upload 25 instruction books', 'contributor', '📜', 75, 2, 'docs_uploaded', 25, false),
  ('docs_50', 'Archive Builder', 'Upload 50 instruction books', 'contributor', '🏛️', 100, 3, 'docs_uploaded', 50, false),
  ('docs_100', 'Loremaster', 'Upload 100 instruction books', 'contributor', '🧙', 200, 3, 'docs_uploaded', 100, false),
  ('docs_250', 'Grand Archivist', 'Upload 250 instruction books', 'contributor', '👑', 350, 4, 'docs_uploaded', 250, false)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category,
  icon = EXCLUDED.icon, points = EXCLUDED.points, tier = EXCLUDED.tier,
  requirement_type = EXCLUDED.requirement_type, requirement_value = EXCLUDED.requirement_value;

-- Step 4: Catalog image submission achievements (category: contributor)
INSERT INTO public.achievements (slug, name, description, category, icon, points, tier, requirement_type, requirement_value, is_secret) VALUES
  ('catalog_img_1', 'Box Art Scout', 'Submit your first catalog image', 'contributor', '🖼️', 10, 1, 'catalog_images_submitted', 1, false),
  ('catalog_img_3', 'Art Contributor', 'Submit 3 catalog images', 'contributor', '🎨', 15, 1, 'catalog_images_submitted', 3, false),
  ('catalog_img_10', 'Visual Curator', 'Submit 10 catalog images', 'contributor', '📸', 30, 2, 'catalog_images_submitted', 10, false),
  ('catalog_img_25', 'Gallery Builder', 'Submit 25 catalog images', 'contributor', '🌟', 50, 2, 'catalog_images_submitted', 25, false),
  ('catalog_img_50', 'Art Director', 'Submit 50 catalog images', 'contributor', '⭐', 100, 3, 'catalog_images_submitted', 50, false),
  ('catalog_img_100', 'Visual Legend', 'Submit 100 catalog images', 'contributor', '👑', 200, 4, 'catalog_images_submitted', 100, false)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category,
  icon = EXCLUDED.icon, points = EXCLUDED.points, tier = EXCLUDED.tier,
  requirement_type = EXCLUDED.requirement_type, requirement_value = EXCLUDED.requirement_value;

-- Step 5: Referral achievements (category: social)
INSERT INTO public.achievements (slug, name, description, category, icon, points, tier, requirement_type, requirement_value, is_secret) VALUES
  ('referral_1', 'First Recruit', 'Refer your first person to GameTaverns', 'social', '👋', 10, 1, 'referrals_completed', 1, false),
  ('referral_3', 'Word Spreader', 'Refer 3 people to GameTaverns', 'social', '📢', 20, 1, 'referrals_completed', 3, false),
  ('referral_5', 'Town Crier', 'Refer 5 people to GameTaverns', 'social', '📣', 30, 1, 'referrals_completed', 5, false),
  ('referral_10', 'Recruiter', 'Refer 10 people to GameTaverns', 'social', '🎯', 50, 2, 'referrals_completed', 10, false),
  ('referral_15', 'Guild Recruiter', 'Refer 15 people to GameTaverns', 'social', '⚔️', 75, 2, 'referrals_completed', 15, false),
  ('referral_25', 'Ambassador', 'Refer 25 people to GameTaverns', 'social', '🏅', 100, 3, 'referrals_completed', 25, false),
  ('referral_50', 'Legend Maker', 'Refer 50 people to GameTaverns', 'social', '👑', 200, 3, 'referrals_completed', 50, false),
  ('referral_100', 'Grand Champion', 'Refer 100 people to GameTaverns', 'social', '🏆', 500, 4, 'referrals_completed', 100, false)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category,
  icon = EXCLUDED.icon, points = EXCLUDED.points, tier = EXCLUDED.tier,
  requirement_type = EXCLUDED.requirement_type, requirement_value = EXCLUDED.requirement_value;
