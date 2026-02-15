
-- Add a composite unique index to prevent duplicate forum categories
-- This covers the natural key: (library_id, club_id, parent_category_id, slug)
CREATE UNIQUE INDEX IF NOT EXISTS idx_forum_categories_unique_scope
  ON forum_categories (
    COALESCE(library_id, '00000000-0000-0000-0000-000000000000'),
    COALESCE(club_id, '00000000-0000-0000-0000-000000000000'),
    COALESCE(parent_category_id, '00000000-0000-0000-0000-000000000000'),
    slug
  );

-- Update the library seed trigger to be idempotent
CREATE OR REPLACE FUNCTION public.seed_library_forum_categories()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  general_id uuid;
  marketplace_id uuid;
BEGIN
  -- Create "General" parent category (skip if exists)
  INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id)
  VALUES ('General', 'general-parent', 'General community discussions', 'MessageSquare', 'blue', 1, true, NEW.id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO general_id;

  -- If it already existed, fetch its id
  IF general_id IS NULL THEN
    SELECT id INTO general_id FROM public.forum_categories
    WHERE library_id = NEW.id AND slug = 'general-parent' AND parent_category_id IS NULL;
  END IF;

  -- Subcategories of General
  INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, parent_category_id) VALUES
    ('Announcements', 'announcements', 'Official news and updates', 'Megaphone', 'amber', 1, true, NEW.id, general_id),
    ('General Discussion', 'general', 'Chat about anything board game related', 'MessageSquare', 'blue', 2, true, NEW.id, general_id),
    ('Looking for Group', 'lfg', 'Find other players for game sessions', 'Users', 'green', 3, true, NEW.id, general_id),
    ('Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 4, true, NEW.id, general_id)
  ON CONFLICT DO NOTHING;

  -- Create "Marketplace" parent category (skip if exists)
  INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id)
  VALUES ('Marketplace', 'marketplace', 'Buy, sell, and trade board games', 'ShoppingBag', 'purple', 2, true, NEW.id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO marketplace_id;

  IF marketplace_id IS NULL THEN
    SELECT id INTO marketplace_id FROM public.forum_categories
    WHERE library_id = NEW.id AND slug = 'marketplace' AND parent_category_id IS NULL;
  END IF;

  -- Subcategories of Marketplace
  INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, parent_category_id) VALUES
    ('Buying', 'buying', 'Looking to buy board games', 'ShoppingCart', 'purple', 1, true, NEW.id, marketplace_id),
    ('Selling', 'selling', 'Board games for sale', 'Tag', 'purple', 2, true, NEW.id, marketplace_id),
    ('Trading', 'trading', 'Trade board games with others', 'ArrowLeftRight', 'purple', 3, true, NEW.id, marketplace_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Update the club seed trigger to be idempotent too
CREATE OR REPLACE FUNCTION public.seed_club_forum_categories()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      ('Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 4, true, NEW.id, general_id)
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
$function$;
