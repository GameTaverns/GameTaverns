
-- Seed "Introduce Yourself" category for site-wide forum
INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, club_id)
SELECT 'Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 5, true, NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.forum_categories WHERE slug = 'introductions' AND library_id IS NULL AND club_id IS NULL AND parent_category_id IS NULL
);

-- Seed for all libraries
INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id)
SELECT 'Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 5, true, l.id
FROM public.libraries l
WHERE NOT EXISTS (
  SELECT 1 FROM public.forum_categories fc WHERE fc.library_id = l.id AND fc.slug = 'introductions' AND fc.parent_category_id IS NULL
);

-- Seed for all clubs
INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id)
SELECT 'Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 5, true, c.id
FROM public.clubs c
WHERE NOT EXISTS (
  SELECT 1 FROM public.forum_categories fc WHERE fc.club_id = c.id AND fc.slug = 'introductions'
);

-- Update library trigger to include Introduce Yourself
CREATE OR REPLACE FUNCTION public.seed_library_forum_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id)
  VALUES
    ('Announcements', 'announcements', 'Official announcements and updates', 'Megaphone', 'amber', 1, true, NEW.id),
    ('General Discussion', 'general', 'Chat about anything board game related', 'MessageSquare', 'blue', 2, true, NEW.id),
    ('Looking for Group', 'lfg', 'Find players for your next game night', 'Users', 'green', 3, true, NEW.id),
    ('Marketplace', 'marketplace', 'Buy, sell, and trade board games', 'ShoppingBag', 'purple', 4, true, NEW.id),
    ('Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 5, true, NEW.id)
  ON CONFLICT DO NOTHING;

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

-- Update club trigger to include Introduce Yourself
CREATE OR REPLACE FUNCTION public.seed_club_forum_categories()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id)
    VALUES
      ('Announcements', 'announcements', 'Official club announcements and updates', 'Megaphone', 'amber', 1, true, NEW.id),
      ('General Discussion', 'general', 'Chat about anything board game related', 'MessageSquare', 'blue', 2, true, NEW.id),
      ('Looking for Group', 'lfg', 'Find players for your next game night', 'Users', 'green', 3, true, NEW.id),
      ('Marketplace', 'marketplace', 'Buy, sell, and trade board games', 'ShoppingBag', 'purple', 4, true, NEW.id),
      ('Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 5, true, NEW.id)
    ON CONFLICT DO NOTHING;

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
