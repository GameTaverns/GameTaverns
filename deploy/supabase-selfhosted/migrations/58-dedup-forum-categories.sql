-- Migration: 58-dedup-forum-categories.sql
-- Deduplicate forum categories and ensure proper parent→child hierarchy.

-- Step 1: Remove exact duplicate rows (same slug + same scope + same parent), keep oldest
DELETE FROM public.forum_categories a
USING public.forum_categories b
WHERE a.slug = b.slug
  AND a.parent_category_id IS NOT DISTINCT FROM b.parent_category_id
  AND COALESCE(a.library_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(b.library_id, '00000000-0000-0000-0000-000000000000'::uuid)
  AND COALESCE(a.club_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(b.club_id, '00000000-0000-0000-0000-000000000000'::uuid)
  AND a.created_at > b.created_at;

-- Step 2: Move any top-level "Introduce Yourself" to be a child of "General" (general-parent)
-- for every scope where general-parent exists
UPDATE public.forum_categories intro
SET parent_category_id = gp.id,
    display_order = 4
FROM public.forum_categories gp
WHERE intro.slug = 'introductions'
  AND intro.parent_category_id IS NULL
  AND gp.slug = 'general-parent'
  AND gp.parent_category_id IS NULL
  AND COALESCE(intro.library_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(gp.library_id, '00000000-0000-0000-0000-000000000000'::uuid)
  AND COALESCE(intro.club_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(gp.club_id, '00000000-0000-0000-0000-000000000000'::uuid);

-- Step 3: Backfill marketplace subcategories (Buying, Selling, Trading) for all scopes
INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, club_id, parent_category_id)
SELECT 'Buying', 'buying', 'Looking to buy board games', 'ShoppingCart', 'purple', 1, true, fc.library_id, fc.club_id, fc.id
FROM public.forum_categories fc
WHERE fc.slug = 'marketplace' AND fc.parent_category_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.forum_categories sub WHERE sub.slug = 'buying' AND sub.parent_category_id = fc.id
);

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, club_id, parent_category_id)
SELECT 'Selling', 'selling', 'Board games for sale', 'Tag', 'purple', 2, true, fc.library_id, fc.club_id, fc.id
FROM public.forum_categories fc
WHERE fc.slug = 'marketplace' AND fc.parent_category_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.forum_categories sub WHERE sub.slug = 'selling' AND sub.parent_category_id = fc.id
);

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, club_id, parent_category_id)
SELECT 'Trading', 'trading', 'Trade board games with others', 'ArrowLeftRight', 'purple', 3, true, fc.library_id, fc.club_id, fc.id
FROM public.forum_categories fc
WHERE fc.slug = 'marketplace' AND fc.parent_category_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.forum_categories sub WHERE sub.slug = 'trading' AND sub.parent_category_id = fc.id
);

-- Step 4: Backfill "Introduce Yourself" as child of general-parent for all scopes missing it
INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, club_id, parent_category_id)
SELECT 'Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 4, true, gp.library_id, gp.club_id, gp.id
FROM public.forum_categories gp
WHERE gp.slug = 'general-parent' AND gp.parent_category_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.forum_categories sub WHERE sub.slug = 'introductions' AND sub.parent_category_id = gp.id
);

-- Step 5: Ensure Introduce Yourself has correct metadata
UPDATE public.forum_categories
SET description = 'Say hello and tell us about yourself',
    icon = 'UserPlus',
    color = 'cyan',
    is_system = true
WHERE slug = 'introductions';

NOTIFY pgrst, 'reload schema';
