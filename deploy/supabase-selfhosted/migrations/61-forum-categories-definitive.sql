-- Migration: 61-forum-categories-definitive.sql
-- =============================================================================
-- DEFINITIVE forum category seeding. Replaces migrations 24, 54, 56, 57, 58, 59.
-- Wipes ALL system categories and reseeds from scratch with correct hierarchy.
--
-- Correct structure:
--   SITE-WIDE:
--     General (locked parent) → Announcements, General Discussion, LFG, Introduce Yourself
--     (NO marketplace at site level)
--
--   LIBRARY + CLUB:
--     General (locked parent) → Announcements, General Discussion, LFG, Introduce Yourself
--     Marketplace (locked parent) → Buying, Selling, Trading
-- =============================================================================

-- ============================================================
-- STEP 1: Delete ALL system-seeded categories (preserves user-created ones)
-- ============================================================
-- Delete children first (subcategories), then parents
DELETE FROM public.forum_categories WHERE is_system = true AND parent_category_id IS NOT NULL;
DELETE FROM public.forum_categories WHERE is_system = true AND parent_category_id IS NULL;

-- Also clean up any orphaned categories that should have been system
-- (categories with known system slugs that weren't flagged)
DELETE FROM public.forum_categories
WHERE slug IN ('general-parent', 'announcements', 'general', 'lfg', 'introductions',
               'marketplace', 'buying', 'selling', 'trading')
  AND parent_category_id IS NOT NULL;

DELETE FROM public.forum_categories
WHERE slug IN ('general-parent', 'marketplace')
  AND parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.forum_threads t
    JOIN public.forum_categories c ON c.id = t.category_id
    WHERE c.id = forum_categories.id
  );

-- Clean up any remaining known-slug orphans at parent level that have no threads
DELETE FROM public.forum_categories
WHERE slug IN ('announcements', 'general', 'lfg', 'introductions', 'buying', 'selling', 'trading')
  AND parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.forum_threads t WHERE t.category_id = forum_categories.id
  );

-- ============================================================
-- STEP 2: Ensure unique index exists
-- ============================================================
DROP INDEX IF EXISTS public.forum_categories_library_slug_unique;
DROP INDEX IF EXISTS public.forum_categories_scope_slug_unique;

CREATE UNIQUE INDEX IF NOT EXISTS forum_categories_scope_slug_unique
ON public.forum_categories (
  COALESCE(library_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(club_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(parent_category_id, '00000000-0000-0000-0000-000000000000'::uuid),
  slug
);

-- ============================================================
-- STEP 3: SITE-WIDE — General parent + 4 subcategories, NO marketplace
-- ============================================================
DO $$
DECLARE
  gp_id uuid;
BEGIN
  INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, club_id, parent_category_id)
  VALUES ('General', 'general-parent', 'General community discussions', 'MessageSquare', 'blue', 1, true, NULL, NULL, NULL)
  ON CONFLICT DO NOTHING;

  SELECT id INTO gp_id FROM public.forum_categories
  WHERE slug = 'general-parent' AND library_id IS NULL AND club_id IS NULL AND parent_category_id IS NULL;

  IF gp_id IS NOT NULL THEN
    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, club_id, parent_category_id) VALUES
      ('Announcements', 'announcements', 'Official platform announcements and updates', 'Megaphone', 'amber', 1, true, NULL, NULL, gp_id),
      ('General Discussion', 'general', 'Chat about anything board game related', 'MessageSquare', 'blue', 2, true, NULL, NULL, gp_id),
      ('Looking for Group', 'lfg', 'Find players for your next game night', 'Users', 'green', 3, true, NULL, NULL, gp_id),
      ('Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 4, true, NULL, NULL, gp_id)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- STEP 4: LIBRARY scope — General + Marketplace parents with subcategories
-- ============================================================
DO $$
DECLARE
  lib RECORD;
  gp_id uuid;
  mp_id uuid;
BEGIN
  FOR lib IN SELECT id FROM public.libraries LOOP
    -- General parent
    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, parent_category_id)
    VALUES ('General', 'general-parent', 'General community discussions', 'MessageSquare', 'blue', 1, true, lib.id, NULL)
    ON CONFLICT DO NOTHING;

    SELECT id INTO gp_id FROM public.forum_categories
    WHERE slug = 'general-parent' AND library_id = lib.id AND parent_category_id IS NULL;

    IF gp_id IS NOT NULL THEN
      INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, parent_category_id) VALUES
        ('Announcements', 'announcements', 'Official announcements and updates', 'Megaphone', 'amber', 1, true, lib.id, gp_id),
        ('General Discussion', 'general', 'Chat about anything board game related', 'MessageSquare', 'blue', 2, true, lib.id, gp_id),
        ('Looking for Group', 'lfg', 'Find players for your next game night', 'Users', 'green', 3, true, lib.id, gp_id),
        ('Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 4, true, lib.id, gp_id)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Marketplace parent
    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, parent_category_id)
    VALUES ('Marketplace', 'marketplace', 'Buy, sell, and trade board games', 'ShoppingBag', 'purple', 2, true, lib.id, NULL)
    ON CONFLICT DO NOTHING;

    SELECT id INTO mp_id FROM public.forum_categories
    WHERE slug = 'marketplace' AND library_id = lib.id AND parent_category_id IS NULL;

    IF mp_id IS NOT NULL THEN
      INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, parent_category_id) VALUES
        ('Buying', 'buying', 'Looking to buy board games', 'ShoppingCart', 'purple', 1, true, lib.id, mp_id),
        ('Selling', 'selling', 'Board games for sale', 'Tag', 'purple', 2, true, lib.id, mp_id),
        ('Trading', 'trading', 'Trade board games with others', 'ArrowLeftRight', 'purple', 3, true, lib.id, mp_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- STEP 5: CLUB scope — General + Marketplace parents with subcategories
-- ============================================================
DO $$
DECLARE
  club RECORD;
  gp_id uuid;
  mp_id uuid;
BEGIN
  FOR club IN SELECT id FROM public.clubs WHERE status = 'approved' LOOP
    -- General parent
    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id, parent_category_id)
    VALUES ('General', 'general-parent', 'General community discussions', 'MessageSquare', 'blue', 1, true, club.id, NULL)
    ON CONFLICT DO NOTHING;

    SELECT id INTO gp_id FROM public.forum_categories
    WHERE slug = 'general-parent' AND club_id = club.id AND parent_category_id IS NULL;

    IF gp_id IS NOT NULL THEN
      INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id, parent_category_id) VALUES
        ('Announcements', 'announcements', 'Official announcements and updates', 'Megaphone', 'amber', 1, true, club.id, gp_id),
        ('General Discussion', 'general', 'Chat about anything board game related', 'MessageSquare', 'blue', 2, true, club.id, gp_id),
        ('Looking for Group', 'lfg', 'Find players for your next game night', 'Users', 'green', 3, true, club.id, gp_id),
        ('Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 4, true, club.id, gp_id)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Marketplace parent
    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id, parent_category_id)
    VALUES ('Marketplace', 'marketplace', 'Buy, sell, and trade board games', 'ShoppingBag', 'purple', 2, true, club.id, NULL)
    ON CONFLICT DO NOTHING;

    SELECT id INTO mp_id FROM public.forum_categories
    WHERE slug = 'marketplace' AND club_id = club.id AND parent_category_id IS NULL;

    IF mp_id IS NOT NULL THEN
      INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id, parent_category_id) VALUES
        ('Buying', 'buying', 'Looking to buy board games', 'ShoppingCart', 'purple', 1, true, club.id, mp_id),
        ('Selling', 'selling', 'Board games for sale', 'Tag', 'purple', 2, true, club.id, mp_id),
        ('Trading', 'trading', 'Trade board games with others', 'ArrowLeftRight', 'purple', 3, true, club.id, mp_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- STEP 6: Update triggers for new libraries/clubs
-- ============================================================

CREATE OR REPLACE FUNCTION public.seed_library_forum_categories()
RETURNS TRIGGER AS $$
DECLARE
  general_id uuid;
  marketplace_id uuid;
BEGIN
  -- General parent (locked)
  INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id)
  VALUES ('General', 'general-parent', 'General community discussions', 'MessageSquare', 'blue', 1, true, NEW.id)
  ON CONFLICT DO NOTHING;

  SELECT id INTO general_id FROM public.forum_categories
  WHERE library_id = NEW.id AND slug = 'general-parent' AND parent_category_id IS NULL LIMIT 1;

  IF general_id IS NOT NULL THEN
    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, parent_category_id) VALUES
      ('Announcements', 'announcements', 'Official announcements and updates', 'Megaphone', 'amber', 1, true, NEW.id, general_id),
      ('General Discussion', 'general', 'Chat about anything board game related', 'MessageSquare', 'blue', 2, true, NEW.id, general_id),
      ('Looking for Group', 'lfg', 'Find players for your next game night', 'Users', 'green', 3, true, NEW.id, general_id),
      ('Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 4, true, NEW.id, general_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Marketplace parent (locked)
  INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id)
  VALUES ('Marketplace', 'marketplace', 'Buy, sell, and trade board games', 'ShoppingBag', 'purple', 2, true, NEW.id)
  ON CONFLICT DO NOTHING;

  SELECT id INTO marketplace_id FROM public.forum_categories
  WHERE library_id = NEW.id AND slug = 'marketplace' AND parent_category_id IS NULL LIMIT 1;

  IF marketplace_id IS NOT NULL THEN
    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, parent_category_id) VALUES
      ('Buying', 'buying', 'Looking to buy board games', 'ShoppingCart', 'purple', 1, true, NEW.id, marketplace_id),
      ('Selling', 'selling', 'Board games for sale', 'Tag', 'purple', 2, true, NEW.id, marketplace_id),
      ('Trading', 'trading', 'Trade board games with others', 'ArrowLeftRight', 'purple', 3, true, NEW.id, marketplace_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS seed_library_forum_categories_trigger ON public.libraries;
CREATE TRIGGER seed_library_forum_categories_trigger
  AFTER INSERT ON public.libraries
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_library_forum_categories();

CREATE OR REPLACE FUNCTION public.seed_club_forum_categories()
RETURNS TRIGGER AS $$
DECLARE
  general_id uuid;
  marketplace_id uuid;
BEGIN
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status <> 'approved') THEN
    -- General parent (locked)
    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id)
    VALUES ('General', 'general-parent', 'General community discussions', 'MessageSquare', 'blue', 1, true, NEW.id)
    ON CONFLICT DO NOTHING;

    SELECT id INTO general_id FROM public.forum_categories
    WHERE club_id = NEW.id AND slug = 'general-parent' AND parent_category_id IS NULL LIMIT 1;

    IF general_id IS NOT NULL THEN
      INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id, parent_category_id) VALUES
        ('Announcements', 'announcements', 'Official announcements and updates', 'Megaphone', 'amber', 1, true, NEW.id, general_id),
        ('General Discussion', 'general', 'Chat about anything board game related', 'MessageSquare', 'blue', 2, true, NEW.id, general_id),
        ('Looking for Group', 'lfg', 'Find players for your next game night', 'Users', 'green', 3, true, NEW.id, general_id),
        ('Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 4, true, NEW.id, general_id)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Marketplace parent (locked)
    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id)
    VALUES ('Marketplace', 'marketplace', 'Buy, sell, and trade board games', 'ShoppingBag', 'purple', 2, true, NEW.id)
    ON CONFLICT DO NOTHING;

    SELECT id INTO marketplace_id FROM public.forum_categories
    WHERE club_id = NEW.id AND slug = 'marketplace' AND parent_category_id IS NULL LIMIT 1;

    IF marketplace_id IS NOT NULL THEN
      INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id, parent_category_id) VALUES
        ('Buying', 'buying', 'Looking to buy board games', 'ShoppingCart', 'purple', 1, true, NEW.id, marketplace_id),
        ('Selling', 'selling', 'Board games for sale', 'Tag', 'purple', 2, true, NEW.id, marketplace_id),
        ('Trading', 'trading', 'Trade board games with others', 'ArrowLeftRight', 'purple', 3, true, NEW.id, marketplace_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS seed_club_forum_categories_trigger ON public.clubs;
DROP TRIGGER IF EXISTS trigger_seed_club_forum_on_approval ON public.clubs;
CREATE TRIGGER seed_club_forum_categories_trigger
  AFTER INSERT OR UPDATE ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_club_forum_categories();

NOTIFY pgrst, 'reload schema';
