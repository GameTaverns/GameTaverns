-- Migration: 55-forum-subcategories.sql
-- Add subcategory support (2-level nesting) to forum_categories.
-- Adds parent_category_id for nesting, seeds default subcategories.

-- Step 1: Add parent_category_id column
ALTER TABLE public.forum_categories
ADD COLUMN IF NOT EXISTS parent_category_id uuid REFERENCES public.forum_categories(id) ON DELETE CASCADE;

-- Step 2: Add index for fast child lookups
CREATE INDEX IF NOT EXISTS idx_forum_categories_parent
ON public.forum_categories (parent_category_id);

-- Step 3: Seed subcategories for Marketplace in site-wide forum
INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, parent_category_id)
SELECT 'Buying', 'buying', 'Looking to buy board games', 'ShoppingCart', 'purple', 1, true, fc.id
FROM public.forum_categories fc
WHERE fc.slug = 'marketplace' AND fc.library_id IS NULL AND fc.club_id IS NULL AND fc.parent_category_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.forum_categories sub WHERE sub.slug = 'buying' AND sub.parent_category_id = fc.id
);

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, parent_category_id)
SELECT 'Selling', 'selling', 'Board games for sale', 'Tag', 'purple', 2, true, fc.id
FROM public.forum_categories fc
WHERE fc.slug = 'marketplace' AND fc.library_id IS NULL AND fc.club_id IS NULL AND fc.parent_category_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.forum_categories sub WHERE sub.slug = 'selling' AND sub.parent_category_id = fc.id
);

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, parent_category_id)
SELECT 'Trading', 'trading', 'Trade board games with others', 'ArrowLeftRight', 'purple', 3, true, fc.id
FROM public.forum_categories fc
WHERE fc.slug = 'marketplace' AND fc.library_id IS NULL AND fc.club_id IS NULL AND fc.parent_category_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.forum_categories sub WHERE sub.slug = 'trading' AND sub.parent_category_id = fc.id
);

-- Step 4: Seed subcategories for all existing library marketplace categories
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

-- Step 5: Seed subcategories for all existing club marketplace categories
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

-- Step 6: Update the seed_club_forum_categories trigger to also seed subcategories
CREATE OR REPLACE FUNCTION public.seed_club_forum_categories()
RETURNS TRIGGER AS $$
DECLARE
  marketplace_id uuid;
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

    -- Now seed marketplace subcategories
    SELECT id INTO marketplace_id FROM public.forum_categories
    WHERE club_id = NEW.id AND slug = 'marketplace' AND parent_category_id IS NULL
    LIMIT 1;

    IF marketplace_id IS NOT NULL THEN
      INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id, parent_category_id)
      VALUES
        ('Buying', 'buying', 'Looking to buy board games', 'ShoppingCart', 'purple', 1, true, NEW.id, marketplace_id),
        ('Selling', 'selling', 'Board games for sale', 'Tag', 'purple', 2, true, NEW.id, marketplace_id),
        ('Trading', 'trading', 'Trade board games with others', 'ArrowLeftRight', 'purple', 3, true, NEW.id, marketplace_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 7: Update unique index to include parent_category_id
DROP INDEX IF EXISTS public.forum_categories_scope_slug_unique;

CREATE UNIQUE INDEX IF NOT EXISTS forum_categories_scope_slug_unique
ON public.forum_categories (
  COALESCE(library_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(club_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(parent_category_id, '00000000-0000-0000-0000-000000000000'::uuid),
  slug
);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
