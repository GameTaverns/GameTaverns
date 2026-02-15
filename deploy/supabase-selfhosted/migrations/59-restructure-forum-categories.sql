-- Migration: 59-restructure-forum-categories.sql
-- Restructure forum categories: General and Marketplace as parent categories,
-- with Announcements, General Discussion, LFG, Introductions as subcategories of General.
-- This migration must be fully idempotent — safe to re-run on every update.sh.

-- ============================================================
-- STEP 0: DEDUP — Remove duplicate subcategories under general-parent
-- that were created by earlier migrations on re-runs.
-- Keep the OLDEST row for each (slug, parent_category_id, library_id, club_id).
-- ============================================================
DELETE FROM public.forum_categories a
USING public.forum_categories b
WHERE a.slug = b.slug
  AND a.parent_category_id IS NOT NULL
  AND a.parent_category_id = b.parent_category_id
  AND COALESCE(a.library_id::text, '') = COALESCE(b.library_id::text, '')
  AND COALESCE(a.club_id::text, '') = COALESCE(b.club_id::text, '')
  AND a.created_at > b.created_at;

-- ============================================================
-- SITE-WIDE scope
-- ============================================================

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, club_id, parent_category_id)
SELECT 'General', 'general-parent', 'General community discussions', 'MessageSquare', 'blue', 1, true, NULL, NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.forum_categories WHERE slug = 'general-parent' AND library_id IS NULL AND club_id IS NULL AND parent_category_id IS NULL
);

UPDATE public.forum_categories SET display_order = 2
WHERE slug = 'marketplace' AND library_id IS NULL AND club_id IS NULL AND parent_category_id IS NULL;

-- Move categories under general-parent (only if still top-level)
UPDATE public.forum_categories SET parent_category_id = (SELECT id FROM public.forum_categories WHERE slug = 'general-parent' AND library_id IS NULL AND club_id IS NULL AND parent_category_id IS NULL), display_order = 1
WHERE slug = 'announcements' AND library_id IS NULL AND club_id IS NULL AND parent_category_id IS NULL;

UPDATE public.forum_categories SET parent_category_id = (SELECT id FROM public.forum_categories WHERE slug = 'general-parent' AND library_id IS NULL AND club_id IS NULL AND parent_category_id IS NULL), display_order = 2
WHERE slug = 'general' AND library_id IS NULL AND club_id IS NULL AND parent_category_id IS NULL;

UPDATE public.forum_categories SET parent_category_id = (SELECT id FROM public.forum_categories WHERE slug = 'general-parent' AND library_id IS NULL AND club_id IS NULL AND parent_category_id IS NULL), display_order = 3
WHERE slug = 'lfg' AND library_id IS NULL AND club_id IS NULL AND parent_category_id IS NULL;

UPDATE public.forum_categories SET parent_category_id = (SELECT id FROM public.forum_categories WHERE slug = 'general-parent' AND library_id IS NULL AND club_id IS NULL AND parent_category_id IS NULL), display_order = 4
WHERE slug = 'introductions' AND library_id IS NULL AND club_id IS NULL AND parent_category_id IS NULL;

-- ============================================================
-- LIBRARY scope
-- ============================================================

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, parent_category_id)
SELECT 'General', 'general-parent', 'General community discussions', 'MessageSquare', 'blue', 1, true, l.id, NULL
FROM public.libraries l
WHERE NOT EXISTS (
  SELECT 1 FROM public.forum_categories fc WHERE fc.slug = 'general-parent' AND fc.library_id = l.id AND fc.parent_category_id IS NULL
);

UPDATE public.forum_categories fc SET parent_category_id = gp.id, display_order = 1
FROM public.forum_categories gp
WHERE fc.slug = 'announcements' AND fc.library_id IS NOT NULL AND fc.parent_category_id IS NULL
  AND gp.slug = 'general-parent' AND gp.library_id = fc.library_id AND gp.parent_category_id IS NULL;

UPDATE public.forum_categories fc SET parent_category_id = gp.id, display_order = 2
FROM public.forum_categories gp
WHERE fc.slug = 'general' AND fc.library_id IS NOT NULL AND fc.parent_category_id IS NULL
  AND gp.slug = 'general-parent' AND gp.library_id = fc.library_id AND gp.parent_category_id IS NULL;

UPDATE public.forum_categories fc SET parent_category_id = gp.id, display_order = 3
FROM public.forum_categories gp
WHERE fc.slug = 'lfg' AND fc.library_id IS NOT NULL AND fc.parent_category_id IS NULL
  AND gp.slug = 'general-parent' AND gp.library_id = fc.library_id AND gp.parent_category_id IS NULL;

UPDATE public.forum_categories fc SET parent_category_id = gp.id, display_order = 4
FROM public.forum_categories gp
WHERE fc.slug = 'introductions' AND fc.library_id IS NOT NULL AND fc.parent_category_id IS NULL
  AND gp.slug = 'general-parent' AND gp.library_id = fc.library_id AND gp.parent_category_id IS NULL;

UPDATE public.forum_categories SET display_order = 2
WHERE slug = 'marketplace' AND library_id IS NOT NULL AND parent_category_id IS NULL;

-- ============================================================
-- CLUB scope
-- ============================================================

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id, parent_category_id)
SELECT 'General', 'general-parent', 'General community discussions', 'MessageSquare', 'blue', 1, true, c.id, NULL
FROM public.clubs c WHERE c.status = 'approved'
AND NOT EXISTS (
  SELECT 1 FROM public.forum_categories fc WHERE fc.slug = 'general-parent' AND fc.club_id = c.id AND fc.parent_category_id IS NULL
);

UPDATE public.forum_categories fc SET parent_category_id = gp.id, display_order = 1
FROM public.forum_categories gp
WHERE fc.slug = 'announcements' AND fc.club_id IS NOT NULL AND fc.parent_category_id IS NULL
  AND gp.slug = 'general-parent' AND gp.club_id = fc.club_id AND gp.parent_category_id IS NULL;

UPDATE public.forum_categories fc SET parent_category_id = gp.id, display_order = 2
FROM public.forum_categories gp
WHERE fc.slug = 'general' AND fc.club_id IS NOT NULL AND fc.parent_category_id IS NULL
  AND gp.slug = 'general-parent' AND gp.club_id = fc.club_id AND gp.parent_category_id IS NULL;

UPDATE public.forum_categories fc SET parent_category_id = gp.id, display_order = 3
FROM public.forum_categories gp
WHERE fc.slug = 'lfg' AND fc.club_id IS NOT NULL AND fc.parent_category_id IS NULL
  AND gp.slug = 'general-parent' AND gp.club_id = fc.club_id AND gp.parent_category_id IS NULL;

UPDATE public.forum_categories fc SET parent_category_id = gp.id, display_order = 4
FROM public.forum_categories gp
WHERE fc.slug = 'introductions' AND fc.club_id IS NOT NULL AND fc.parent_category_id IS NULL
  AND gp.slug = 'general-parent' AND gp.club_id = fc.club_id AND gp.parent_category_id IS NULL;

UPDATE public.forum_categories SET display_order = 2
WHERE slug = 'marketplace' AND club_id IS NOT NULL AND parent_category_id IS NULL;

-- ============================================================
-- Update seed triggers for new libraries/clubs (with ON CONFLICT)
-- ============================================================

CREATE OR REPLACE FUNCTION public.seed_library_forum_categories()
RETURNS TRIGGER AS $$
DECLARE
  general_id uuid;
  marketplace_id uuid;
BEGIN
  -- Insert general-parent, get its id
  INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id)
  VALUES ('General', 'general-parent', 'General community discussions', 'MessageSquare', 'blue', 1, true, NEW.id)
  ON CONFLICT DO NOTHING;

  SELECT id INTO general_id FROM public.forum_categories
  WHERE library_id = NEW.id AND slug = 'general-parent' AND parent_category_id IS NULL LIMIT 1;

  IF general_id IS NOT NULL THEN
    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, parent_category_id) VALUES
      ('Announcements', 'announcements', 'Official news and updates', 'Megaphone', 'amber', 1, true, NEW.id, general_id),
      ('General Discussion', 'general', 'Chat about anything board game related', 'MessageSquare', 'blue', 2, true, NEW.id, general_id),
      ('Looking for Group', 'lfg', 'Find other players for game sessions', 'Users', 'green', 3, true, NEW.id, general_id),
      ('Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 4, true, NEW.id, general_id)
    ON CONFLICT DO NOTHING;
  END IF;

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

CREATE OR REPLACE FUNCTION public.seed_club_forum_categories()
RETURNS TRIGGER AS $$
DECLARE
  general_id uuid;
  marketplace_id uuid;
BEGIN
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status <> 'approved') THEN
    INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id)
    VALUES ('General', 'general-parent', 'General community discussions', 'MessageSquare', 'blue', 1, true, NEW.id)
    ON CONFLICT DO NOTHING;

    SELECT id INTO general_id FROM public.forum_categories
    WHERE club_id = NEW.id AND slug = 'general-parent' AND parent_category_id IS NULL LIMIT 1;

    IF general_id IS NOT NULL THEN
      INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id, parent_category_id) VALUES
        ('Announcements', 'announcements', 'Official news and updates', 'Megaphone', 'amber', 1, true, NEW.id, general_id),
        ('General Discussion', 'general', 'Chat about anything board game related', 'MessageSquare', 'blue', 2, true, NEW.id, general_id),
        ('Looking for Group', 'lfg', 'Find other players for game sessions', 'Users', 'green', 3, true, NEW.id, general_id),
        ('Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 4, true, NEW.id, general_id)
      ON CONFLICT DO NOTHING;
    END IF;

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

-- ============================================================
-- FINAL CLEANUP: Remove any remaining orphaned top-level duplicates
-- and duplicate subcategories under the same parent.
-- ============================================================

-- Remove top-level categories that should be subcategories
DELETE FROM public.forum_categories dup
WHERE dup.parent_category_id IS NULL
  AND dup.slug IN ('announcements', 'general', 'lfg', 'introductions')
  AND EXISTS (
    SELECT 1 FROM public.forum_categories sub
    JOIN public.forum_categories gp ON sub.parent_category_id = gp.id
      AND gp.slug = 'general-parent'
    WHERE sub.slug = dup.slug
      AND COALESCE(sub.library_id::text, '') = COALESCE(dup.library_id::text, '')
      AND COALESCE(sub.club_id::text, '') = COALESCE(dup.club_id::text, '')
  );

-- Remove duplicate subcategories under same parent (keep oldest)
DELETE FROM public.forum_categories a
USING public.forum_categories b
WHERE a.slug = b.slug
  AND a.parent_category_id IS NOT NULL
  AND a.parent_category_id = b.parent_category_id
  AND COALESCE(a.library_id::text, '') = COALESCE(b.library_id::text, '')
  AND COALESCE(a.club_id::text, '') = COALESCE(b.club_id::text, '')
  AND a.created_at > b.created_at;

NOTIFY pgrst, 'reload schema';
