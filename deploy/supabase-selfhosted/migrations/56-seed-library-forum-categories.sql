-- Migration: 56-seed-library-forum-categories.sql
-- Auto-seed forum categories (+ marketplace subcategories) when a new library is created.
-- Also backfills existing libraries that are missing forum categories.

-- Step 1: Create the trigger function
CREATE OR REPLACE FUNCTION public.seed_library_forum_categories()
RETURNS TRIGGER AS $$
DECLARE
  marketplace_id uuid;
BEGIN
  -- Seed default categories for the new library
  INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id)
  VALUES
    ('Announcements', 'announcements', 'Official announcements and updates', 'Megaphone', 'amber', 1, true, NEW.id),
    ('General Discussion', 'general', 'Chat about anything board game related', 'MessageSquare', 'blue', 2, true, NEW.id),
    ('Looking for Group', 'lfg', 'Find players for your next game night', 'Users', 'green', 3, true, NEW.id),
    ('Marketplace', 'marketplace', 'Buy, sell, and trade board games', 'ShoppingBag', 'purple', 4, true, NEW.id),
    ('Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 5, true, NEW.id)
  ON CONFLICT DO NOTHING;

  -- Now seed marketplace subcategories
  SELECT id INTO marketplace_id FROM public.forum_categories
  WHERE library_id = NEW.id AND slug = 'marketplace' AND parent_category_id IS NULL
  LIMIT 1;

  IF marketplace_id IS NOT NULL THEN
    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, parent_category_id)
    VALUES
      ('Buying', 'buying', 'Looking to buy board games', 'ShoppingCart', 'purple', 1, true, NEW.id, marketplace_id),
      ('Selling', 'selling', 'Board games for sale', 'Tag', 'purple', 2, true, NEW.id, marketplace_id),
      ('Trading', 'trading', 'Trade board games with others', 'ArrowLeftRight', 'purple', 3, true, NEW.id, marketplace_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 2: Attach trigger to libraries table (fires on INSERT)
DROP TRIGGER IF EXISTS seed_library_forum_categories_trigger ON public.libraries;
CREATE TRIGGER seed_library_forum_categories_trigger
  AFTER INSERT ON public.libraries
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_library_forum_categories();

-- Step 3: Backfill existing libraries that don't have forum categories yet
INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id)
SELECT 'Announcements', 'announcements', 'Official announcements and updates', 'Megaphone', 'amber', 1, true, l.id
FROM public.libraries l
WHERE NOT EXISTS (
  SELECT 1 FROM public.forum_categories fc WHERE fc.library_id = l.id AND fc.slug = 'announcements' AND fc.parent_category_id IS NULL
);

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id)
SELECT 'General Discussion', 'general', 'Chat about anything board game related', 'MessageSquare', 'blue', 2, true, l.id
FROM public.libraries l
WHERE NOT EXISTS (
  SELECT 1 FROM public.forum_categories fc WHERE fc.library_id = l.id AND fc.slug = 'general' AND fc.parent_category_id IS NULL
);

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id)
SELECT 'Looking for Group', 'lfg', 'Find players for your next game night', 'Users', 'green', 3, true, l.id
FROM public.libraries l
WHERE NOT EXISTS (
  SELECT 1 FROM public.forum_categories fc WHERE fc.library_id = l.id AND fc.slug = 'lfg' AND fc.parent_category_id IS NULL
);

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id)
SELECT 'Marketplace', 'marketplace', 'Buy, sell, and trade board games', 'ShoppingBag', 'purple', 4, true, l.id
FROM public.libraries l
WHERE NOT EXISTS (
  SELECT 1 FROM public.forum_categories fc WHERE fc.library_id = l.id AND fc.slug = 'marketplace' AND fc.parent_category_id IS NULL
);

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id)
SELECT 'Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 5, true, l.id
FROM public.libraries l
WHERE NOT EXISTS (
  SELECT 1 FROM public.forum_categories fc WHERE fc.library_id = l.id AND fc.slug = 'introductions' AND fc.parent_category_id IS NULL
);

-- Step 4: Backfill marketplace subcategories for all existing libraries
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

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
