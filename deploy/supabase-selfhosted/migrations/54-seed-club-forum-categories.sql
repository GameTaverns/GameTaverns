-- Migration: 54-seed-club-forum-categories.sql
-- Pre-seed club forums with the same default categories as the site-wide forum.
-- Also fix the unique index to account for club_id.
-- NOTE: NOT EXISTS checks must NOT filter on parent_category_id IS NULL
-- because migration 59 restructures categories under general-parent.

-- Step 0: Remove any duplicate site-wide categories (keep oldest)
DELETE FROM forum_categories a
USING forum_categories b
WHERE a.slug = b.slug
  AND a.library_id IS NULL AND b.library_id IS NULL
  AND a.club_id IS NULL AND b.club_id IS NULL
  AND a.parent_category_id IS NOT DISTINCT FROM b.parent_category_id
  AND a.created_at > b.created_at;

-- Step 1: Drop the old unique index that doesn't account for club_id
DROP INDEX IF EXISTS public.forum_categories_library_slug_unique;

-- Step 2: Create a new unique index that scopes slugs by library AND club AND parent
CREATE UNIQUE INDEX IF NOT EXISTS forum_categories_scope_slug_unique
ON public.forum_categories (
  COALESCE(library_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(club_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(parent_category_id, '00000000-0000-0000-0000-000000000000'::uuid),
  slug
);

-- Step 3: Seed for all existing clubs that don't already have categories
-- Do NOT filter on parent_category_id — categories may exist as subcategories
INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id)
SELECT 'Announcements', 'announcements', 'Official club announcements and updates', 'Megaphone', 'amber', 1, true, c.id
FROM public.clubs c
WHERE NOT EXISTS (
  SELECT 1 FROM public.forum_categories fc WHERE fc.club_id = c.id AND fc.slug = 'announcements'
);

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id)
SELECT 'General Discussion', 'general', 'Chat about anything board game related', 'MessageSquare', 'blue', 2, true, c.id
FROM public.clubs c
WHERE NOT EXISTS (
  SELECT 1 FROM public.forum_categories fc WHERE fc.club_id = c.id AND fc.slug = 'general'
);

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id)
SELECT 'Looking for Group', 'lfg', 'Find players for your next game night', 'Users', 'green', 3, true, c.id
FROM public.clubs c
WHERE NOT EXISTS (
  SELECT 1 FROM public.forum_categories fc WHERE fc.club_id = c.id AND fc.slug = 'lfg'
);

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id)
SELECT 'Marketplace', 'marketplace', 'Buy, sell, and trade board games', 'ShoppingBag', 'purple', 4, true, c.id
FROM public.clubs c
WHERE NOT EXISTS (
  SELECT 1 FROM public.forum_categories fc WHERE fc.club_id = c.id AND fc.slug = 'marketplace'
);

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id)
SELECT 'Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 5, true, c.id
FROM public.clubs c
WHERE NOT EXISTS (
  SELECT 1 FROM public.forum_categories fc WHERE fc.club_id = c.id AND fc.slug = 'introductions'
);

-- Step 4: Create a trigger function to auto-seed categories when a new club is approved
-- (will be overwritten by migration 59 with hierarchical version)
CREATE OR REPLACE FUNCTION public.seed_club_forum_categories()
RETURNS TRIGGER AS $$
DECLARE
  general_id uuid;
  marketplace_id uuid;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
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

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS seed_club_forum_categories_trigger ON public.clubs;
CREATE TRIGGER seed_club_forum_categories_trigger
  AFTER INSERT OR UPDATE ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_club_forum_categories();
