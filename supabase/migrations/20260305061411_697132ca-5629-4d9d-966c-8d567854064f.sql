
-- 1. Backfill: Add "Events" subcategory under "General" parent for all existing LIBRARIES
INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, parent_category_id)
SELECT 'Events', 'events', 'Event announcements and discussions', 'Calendar', 'rose', 5, true, gp.library_id, gp.id
FROM public.forum_categories gp
WHERE gp.slug = 'general-parent' AND gp.library_id IS NOT NULL AND gp.parent_category_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.forum_categories sub WHERE sub.slug = 'events' AND sub.parent_category_id = gp.id
);

-- 2. Backfill: Add "Events" subcategory under "General" parent for all existing CLUBS
INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id, parent_category_id)
SELECT 'Events', 'events', 'Event announcements and discussions', 'Calendar', 'rose', 5, true, gp.club_id, gp.id
FROM public.forum_categories gp
WHERE gp.slug = 'general-parent' AND gp.club_id IS NOT NULL AND gp.parent_category_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.forum_categories sub WHERE sub.slug = 'events' AND sub.parent_category_id = gp.id
);

-- 3. Backfill: Add "Events" subcategory for SITE-WIDE forum (under general-parent if it exists)
INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, parent_category_id)
SELECT 'Events', 'events', 'Event announcements and discussions', 'Calendar', 'rose', 5, true, gp.id
FROM public.forum_categories gp
WHERE gp.slug = 'general-parent' AND gp.library_id IS NULL AND gp.club_id IS NULL AND gp.parent_category_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.forum_categories sub WHERE sub.slug = 'events' AND sub.parent_category_id = gp.id
);

-- 4. Update LIBRARY trigger function to include Events subcategory
CREATE OR REPLACE FUNCTION public.seed_library_forum_categories()
RETURNS TRIGGER AS $$
DECLARE
  general_id uuid;
  marketplace_id uuid;
BEGIN
  INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id)
  VALUES ('General', 'general-parent', 'General community discussions', 'MessageSquare', 'blue', 1, true, NEW.id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO general_id;

  IF general_id IS NULL THEN
    SELECT id INTO general_id FROM public.forum_categories
    WHERE library_id = NEW.id AND slug = 'general-parent' AND parent_category_id IS NULL;
  END IF;

  INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, parent_category_id) VALUES
    ('Announcements', 'announcements', 'Official news and updates', 'Megaphone', 'amber', 1, true, NEW.id, general_id),
    ('General Discussion', 'general', 'Chat about anything board game related', 'MessageSquare', 'blue', 2, true, NEW.id, general_id),
    ('Looking for Group', 'lfg', 'Find other players for game sessions', 'Users', 'green', 3, true, NEW.id, general_id),
    ('Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 4, true, NEW.id, general_id),
    ('Events', 'events', 'Event announcements and discussions', 'Calendar', 'rose', 5, true, NEW.id, general_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id)
  VALUES ('Marketplace', 'marketplace', 'Buy, sell, and trade board games', 'ShoppingBag', 'purple', 2, true, NEW.id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO marketplace_id;

  IF marketplace_id IS NULL THEN
    SELECT id INTO marketplace_id FROM public.forum_categories
    WHERE library_id = NEW.id AND slug = 'marketplace' AND parent_category_id IS NULL;
  END IF;

  INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, parent_category_id) VALUES
    ('Buying', 'buying', 'Looking to buy board games', 'ShoppingCart', 'purple', 1, true, NEW.id, marketplace_id),
    ('Selling', 'selling', 'Board games for sale', 'Tag', 'purple', 2, true, NEW.id, marketplace_id),
    ('Trading', 'trading', 'Trade board games with others', 'ArrowLeftRight', 'purple', 3, true, NEW.id, marketplace_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Update CLUB trigger function to include Events subcategory
CREATE OR REPLACE FUNCTION public.seed_club_forum_categories()
RETURNS TRIGGER AS $$
DECLARE
  general_id uuid;
  marketplace_id uuid;
BEGIN
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status <> 'approved') THEN
    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id)
    VALUES ('General', 'general-parent', 'General community discussions', 'MessageSquare', 'blue', 1, true, NEW.id)
    ON CONFLICT DO NOTHING
    RETURNING id INTO general_id;

    IF general_id IS NULL THEN
      SELECT id INTO general_id FROM public.forum_categories
      WHERE club_id = NEW.id AND slug = 'general-parent' AND parent_category_id IS NULL;
    END IF;

    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id, parent_category_id) VALUES
      ('Announcements', 'announcements', 'Official news and updates', 'Megaphone', 'amber', 1, true, NEW.id, general_id),
      ('General Discussion', 'general', 'Chat about anything board game related', 'MessageSquare', 'blue', 2, true, NEW.id, general_id),
      ('Looking for Group', 'lfg', 'Find other players for game sessions', 'Users', 'green', 3, true, NEW.id, general_id),
      ('Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 4, true, NEW.id, general_id),
      ('Events', 'events', 'Event announcements and discussions', 'Calendar', 'rose', 5, true, NEW.id, general_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id)
    VALUES ('Marketplace', 'marketplace', 'Buy, sell, and trade board games', 'ShoppingBag', 'purple', 2, true, NEW.id)
    ON CONFLICT DO NOTHING
    RETURNING id INTO marketplace_id;

    IF marketplace_id IS NULL THEN
      SELECT id INTO marketplace_id FROM public.forum_categories
      WHERE club_id = NEW.id AND slug = 'marketplace' AND parent_category_id IS NULL;
    END IF;

    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id, parent_category_id) VALUES
      ('Buying', 'buying', 'Looking to buy board games', 'ShoppingCart', 'purple', 1, true, NEW.id, marketplace_id),
      ('Selling', 'selling', 'Board games for sale', 'Tag', 'purple', 2, true, NEW.id, marketplace_id),
      ('Trading', 'trading', 'Trade board games with others', 'ArrowLeftRight', 'purple', 3, true, NEW.id, marketplace_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

NOTIFY pgrst, 'reload schema';
