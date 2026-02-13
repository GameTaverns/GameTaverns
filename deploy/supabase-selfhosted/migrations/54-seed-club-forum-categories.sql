-- Migration: 54-seed-club-forum-categories.sql
-- Pre-seed club forums with the same 4 default categories as the site-wide forum.

-- Seed for all existing clubs that don't already have categories
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

-- Create a trigger function to auto-seed categories when a new club is approved
CREATE OR REPLACE FUNCTION public.seed_club_forum_categories()
RETURNS TRIGGER AS $$
BEGIN
  -- Only seed when a club becomes approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id)
    VALUES
      ('Announcements', 'announcements', 'Official club announcements and updates', 'Megaphone', 'amber', 1, true, NEW.id),
      ('General Discussion', 'general', 'Chat about anything board game related', 'MessageSquare', 'blue', 2, true, NEW.id),
      ('Looking for Group', 'lfg', 'Find players for your next game night', 'Users', 'green', 3, true, NEW.id),
      ('Marketplace', 'marketplace', 'Buy, sell, and trade board games', 'ShoppingBag', 'purple', 4, true, NEW.id)
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
