-- Migration: 57-seed-marketplace-subcategories.sql
-- Backfill marketplace subcategories (Buying, Selling, Trading) for all scopes
-- that are missing them: site-wide, library-scoped, and club-scoped.
-- Also backfill "Introduce Yourself" category for site-wide forum.

-- Site-wide "Introduce Yourself"
INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, club_id)
SELECT 'Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 5, true, NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.forum_categories WHERE slug = 'introductions' AND library_id IS NULL AND club_id IS NULL AND parent_category_id IS NULL
);

-- Site-wide marketplace subcategories
INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, club_id, parent_category_id)
SELECT 'Buying', 'buying', 'Looking to buy board games', 'ShoppingCart', 'purple', 1, true, NULL, NULL, fc.id
FROM public.forum_categories fc
WHERE fc.slug = 'marketplace' AND fc.library_id IS NULL AND fc.club_id IS NULL AND fc.parent_category_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.forum_categories sub WHERE sub.slug = 'buying' AND sub.parent_category_id = fc.id
);

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, club_id, parent_category_id)
SELECT 'Selling', 'selling', 'Board games for sale', 'Tag', 'purple', 2, true, NULL, NULL, fc.id
FROM public.forum_categories fc
WHERE fc.slug = 'marketplace' AND fc.library_id IS NULL AND fc.club_id IS NULL AND fc.parent_category_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.forum_categories sub WHERE sub.slug = 'selling' AND sub.parent_category_id = fc.id
);

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, club_id, parent_category_id)
SELECT 'Trading', 'trading', 'Trade board games with others', 'ArrowLeftRight', 'purple', 3, true, NULL, NULL, fc.id
FROM public.forum_categories fc
WHERE fc.slug = 'marketplace' AND fc.library_id IS NULL AND fc.club_id IS NULL AND fc.parent_category_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.forum_categories sub WHERE sub.slug = 'trading' AND sub.parent_category_id = fc.id
);

-- Library-scoped marketplace subcategories
INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, parent_category_id)
SELECT 'Buying', 'buying', 'Looking to buy board games', 'ShoppingCart', 'purple', 1, true, fc.library_id, fc.id
FROM public.forum_categories fc
WHERE fc.slug = 'marketplace' AND fc.library_id IS NOT NULL AND fc.parent_category_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.forum_categories sub WHERE sub.slug = 'buying' AND sub.parent_category_id = fc.id
);

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, parent_category_id)
SELECT 'Selling', 'selling', 'Board games for sale', 'Tag', 'purple', 2, true, fc.library_id, fc.id
FROM public.forum_categories fc
WHERE fc.slug = 'marketplace' AND fc.library_id IS NOT NULL AND fc.parent_category_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.forum_categories sub WHERE sub.slug = 'selling' AND sub.parent_category_id = fc.id
);

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, parent_category_id)
SELECT 'Trading', 'trading', 'Trade board games with others', 'ArrowLeftRight', 'purple', 3, true, fc.library_id, fc.id
FROM public.forum_categories fc
WHERE fc.slug = 'marketplace' AND fc.library_id IS NOT NULL AND fc.parent_category_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.forum_categories sub WHERE sub.slug = 'trading' AND sub.parent_category_id = fc.id
);

-- Club-scoped marketplace subcategories
INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id, parent_category_id)
SELECT 'Buying', 'buying', 'Looking to buy board games', 'ShoppingCart', 'purple', 1, true, fc.club_id, fc.id
FROM public.forum_categories fc
WHERE fc.slug = 'marketplace' AND fc.club_id IS NOT NULL AND fc.parent_category_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.forum_categories sub WHERE sub.slug = 'buying' AND sub.parent_category_id = fc.id
);

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id, parent_category_id)
SELECT 'Selling', 'selling', 'Board games for sale', 'Tag', 'purple', 2, true, fc.club_id, fc.id
FROM public.forum_categories fc
WHERE fc.slug = 'marketplace' AND fc.club_id IS NOT NULL AND fc.parent_category_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.forum_categories sub WHERE sub.slug = 'selling' AND sub.parent_category_id = fc.id
);

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id, parent_category_id)
SELECT 'Trading', 'trading', 'Trade board games with others', 'ArrowLeftRight', 'purple', 3, true, fc.club_id, fc.id
FROM public.forum_categories fc
WHERE fc.slug = 'marketplace' AND fc.club_id IS NOT NULL AND fc.parent_category_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.forum_categories sub WHERE sub.slug = 'trading' AND sub.parent_category_id = fc.id
);

NOTIFY pgrst, 'reload schema';
