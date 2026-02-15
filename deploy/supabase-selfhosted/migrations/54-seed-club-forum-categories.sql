-- Migration: 54-seed-club-forum-categories.sql
-- Pre-seed club forums with the same default categories as the site-wide forum.
-- Also fix the unique index to account for club_id.

-- Step 0: Remove any duplicate site-wide categories (keep oldest)
DELETE FROM forum_categories a
USING forum_categories b
WHERE a.slug = b.slug
  AND a.library_id IS NULL AND b.library_id IS NULL
  AND a.club_id IS NULL AND b.club_id IS NULL
  AND a.created_at > b.created_at;

-- Step 1: Drop the old unique index that doesn't account for club_id
DROP INDEX IF EXISTS public.forum_categories_library_slug_unique;

-- Step 2: Create a new unique index that scopes slugs by library AND club
CREATE UNIQUE INDEX IF NOT EXISTS forum_categories_scope_slug_unique
ON public.forum_categories (
  COALESCE(library_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(club_id, '00000000-0000-0000-0000-000000000000'::uuid),
  slug
);

-- Step 3: Seed for all existing clubs that don't already have categories
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

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS seed_club_forum_categories_trigger ON public.clubs;
CREATE TRIGGER seed_club_forum_categories_trigger
  AFTER INSERT OR UPDATE ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_club_forum_categories();
