
-- =============================================
-- Seed default forum categories for ALL libraries
-- =============================================

-- 1. Seed 4 default categories for every library missing them
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

-- 2. Seed marketplace subcategories for ALL scopes (site-wide, library, club)

-- Site-wide
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

-- Library-scoped
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

-- Club-scoped
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

-- 3. Fix the library_settings trigger to use ON CONFLICT properly
CREATE OR REPLACE FUNCTION public.create_library_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.library_settings (library_id)
    VALUES (NEW.id)
    ON CONFLICT (library_id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- 4. Also create a trigger to auto-seed forum categories when a new library is created
CREATE OR REPLACE FUNCTION public.seed_library_forum_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id)
  VALUES
    ('Announcements', 'announcements', 'Official announcements and updates', 'Megaphone', 'amber', 1, true, NEW.id),
    ('General Discussion', 'general', 'Chat about anything board game related', 'MessageSquare', 'blue', 2, true, NEW.id),
    ('Looking for Group', 'lfg', 'Find players for your next game night', 'Users', 'green', 3, true, NEW.id),
    ('Marketplace', 'marketplace', 'Buy, sell, and trade board games', 'ShoppingBag', 'purple', 4, true, NEW.id)
  ON CONFLICT DO NOTHING;

  -- Seed marketplace subcategories
  INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, parent_category_id)
  SELECT sub.name, sub.slug, sub.description, sub.icon, 'purple', sub.display_order, true, NEW.id, fc.id
  FROM (VALUES
    ('Buying', 'buying', 'Looking to buy board games', 'ShoppingCart', 1),
    ('Selling', 'selling', 'Board games for sale', 'Tag', 2),
    ('Trading', 'trading', 'Trade board games with others', 'ArrowLeftRight', 3)
  ) AS sub(name, slug, description, icon, display_order)
  CROSS JOIN public.forum_categories fc
  WHERE fc.slug = 'marketplace' AND fc.library_id = NEW.id AND fc.parent_category_id IS NULL
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS seed_library_forum_categories_trigger ON public.libraries;
CREATE TRIGGER seed_library_forum_categories_trigger
  AFTER INSERT ON public.libraries
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_library_forum_categories();

-- 5. Update club trigger to also seed marketplace subcategories
CREATE OR REPLACE FUNCTION public.seed_club_forum_categories()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id)
    VALUES
      ('Announcements', 'announcements', 'Official club announcements and updates', 'Megaphone', 'amber', 1, true, NEW.id),
      ('General Discussion', 'general', 'Chat about anything board game related', 'MessageSquare', 'blue', 2, true, NEW.id),
      ('Looking for Group', 'lfg', 'Find players for your next game night', 'Users', 'green', 3, true, NEW.id),
      ('Marketplace', 'marketplace', 'Buy, sell, and trade board games', 'ShoppingBag', 'purple', 4, true, NEW.id)
    ON CONFLICT DO NOTHING;

    -- Seed marketplace subcategories
    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id, parent_category_id)
    SELECT sub.name, sub.slug, sub.description, sub.icon, 'purple', sub.display_order, true, NEW.id, fc.id
    FROM (VALUES
      ('Buying', 'buying', 'Looking to buy board games', 'ShoppingCart', 1),
      ('Selling', 'selling', 'Board games for sale', 'Tag', 2),
      ('Trading', 'trading', 'Trade board games with others', 'ArrowLeftRight', 3)
    ) AS sub(name, slug, description, icon, display_order)
    CROSS JOIN public.forum_categories fc
    WHERE fc.slug = 'marketplace' AND fc.club_id = NEW.id AND fc.parent_category_id IS NULL
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

NOTIFY pgrst, 'reload schema';
