
-- Step 1: Create "General" parent category for site-wide scope
INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, club_id, parent_category_id)
SELECT 'General', 'general-parent', 'General community discussions', 'MessageSquare', 'blue', 1, true, NULL, NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.forum_categories WHERE slug = 'general-parent' AND library_id IS NULL AND club_id IS NULL AND parent_category_id IS NULL
);

-- Step 2: Update Marketplace to display_order 2
UPDATE public.forum_categories
SET display_order = 2
WHERE slug = 'marketplace' AND library_id IS NULL AND club_id IS NULL AND parent_category_id IS NULL;

-- Step 3: Move Announcements under General parent (site-wide)
UPDATE public.forum_categories
SET parent_category_id = (SELECT id FROM public.forum_categories WHERE slug = 'general-parent' AND library_id IS NULL AND club_id IS NULL AND parent_category_id IS NULL),
    display_order = 1
WHERE slug = 'announcements' AND library_id IS NULL AND club_id IS NULL AND parent_category_id IS NULL;

-- Step 4: Move General Discussion under General parent (site-wide)
UPDATE public.forum_categories
SET parent_category_id = (SELECT id FROM public.forum_categories WHERE slug = 'general-parent' AND library_id IS NULL AND club_id IS NULL AND parent_category_id IS NULL),
    display_order = 2
WHERE slug = 'general' AND library_id IS NULL AND club_id IS NULL AND parent_category_id IS NULL;

-- Step 5: Move Looking for Group under General parent (site-wide)
UPDATE public.forum_categories
SET parent_category_id = (SELECT id FROM public.forum_categories WHERE slug = 'general-parent' AND library_id IS NULL AND club_id IS NULL AND parent_category_id IS NULL),
    display_order = 3
WHERE slug = 'lfg' AND library_id IS NULL AND club_id IS NULL AND parent_category_id IS NULL;

-- Step 6: Move Introduce Yourself under General parent (site-wide)
UPDATE public.forum_categories
SET parent_category_id = (SELECT id FROM public.forum_categories WHERE slug = 'general-parent' AND library_id IS NULL AND club_id IS NULL AND parent_category_id IS NULL),
    display_order = 4
WHERE slug = 'introductions' AND library_id IS NULL AND club_id IS NULL AND parent_category_id IS NULL;

-- Step 7: Do the same for ALL library-scoped forums
-- Create "General" parent for each library that doesn't have one
INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id, parent_category_id)
SELECT 'General', 'general-parent', 'General community discussions', 'MessageSquare', 'blue', 1, true, l.id, NULL
FROM public.libraries l
WHERE NOT EXISTS (
  SELECT 1 FROM public.forum_categories fc WHERE fc.slug = 'general-parent' AND fc.library_id = l.id AND fc.parent_category_id IS NULL
);

-- Move library Announcements under their library's General parent
UPDATE public.forum_categories fc
SET parent_category_id = gp.id, display_order = 1
FROM public.forum_categories gp
WHERE fc.slug = 'announcements' AND fc.library_id IS NOT NULL AND fc.parent_category_id IS NULL
  AND gp.slug = 'general-parent' AND gp.library_id = fc.library_id AND gp.parent_category_id IS NULL;

-- Move library General Discussion under their library's General parent
UPDATE public.forum_categories fc
SET parent_category_id = gp.id, display_order = 2
FROM public.forum_categories gp
WHERE fc.slug = 'general' AND fc.library_id IS NOT NULL AND fc.parent_category_id IS NULL
  AND gp.slug = 'general-parent' AND gp.library_id = fc.library_id AND gp.parent_category_id IS NULL;

-- Move library LFG under their library's General parent
UPDATE public.forum_categories fc
SET parent_category_id = gp.id, display_order = 3
FROM public.forum_categories gp
WHERE fc.slug = 'lfg' AND fc.library_id IS NOT NULL AND fc.parent_category_id IS NULL
  AND gp.slug = 'general-parent' AND gp.library_id = fc.library_id AND gp.parent_category_id IS NULL;

-- Move library Introduce Yourself under their library's General parent
UPDATE public.forum_categories fc
SET parent_category_id = gp.id, display_order = 4
FROM public.forum_categories gp
WHERE fc.slug = 'introductions' AND fc.library_id IS NOT NULL AND fc.parent_category_id IS NULL
  AND gp.slug = 'general-parent' AND gp.library_id = fc.library_id AND gp.parent_category_id IS NULL;

-- Update library marketplace display order
UPDATE public.forum_categories
SET display_order = 2
WHERE slug = 'marketplace' AND library_id IS NOT NULL AND parent_category_id IS NULL;

-- Step 8: Do the same for ALL club-scoped forums
INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, club_id, parent_category_id)
SELECT 'General', 'general-parent', 'General community discussions', 'MessageSquare', 'blue', 1, true, c.id, NULL
FROM public.clubs c
WHERE c.status = 'approved'
AND NOT EXISTS (
  SELECT 1 FROM public.forum_categories fc WHERE fc.slug = 'general-parent' AND fc.club_id = c.id AND fc.parent_category_id IS NULL
);

-- Move club Announcements under their club's General parent
UPDATE public.forum_categories fc
SET parent_category_id = gp.id, display_order = 1
FROM public.forum_categories gp
WHERE fc.slug = 'announcements' AND fc.club_id IS NOT NULL AND fc.parent_category_id IS NULL
  AND gp.slug = 'general-parent' AND gp.club_id = fc.club_id AND gp.parent_category_id IS NULL;

UPDATE public.forum_categories fc
SET parent_category_id = gp.id, display_order = 2
FROM public.forum_categories gp
WHERE fc.slug = 'general' AND fc.club_id IS NOT NULL AND fc.parent_category_id IS NULL
  AND gp.slug = 'general-parent' AND gp.club_id = fc.club_id AND gp.parent_category_id IS NULL;

UPDATE public.forum_categories fc
SET parent_category_id = gp.id, display_order = 3
FROM public.forum_categories gp
WHERE fc.slug = 'lfg' AND fc.club_id IS NOT NULL AND fc.parent_category_id IS NULL
  AND gp.slug = 'general-parent' AND gp.club_id = fc.club_id AND gp.parent_category_id IS NULL;

UPDATE public.forum_categories fc
SET parent_category_id = gp.id, display_order = 4
FROM public.forum_categories gp
WHERE fc.slug = 'introductions' AND fc.club_id IS NOT NULL AND fc.parent_category_id IS NULL
  AND gp.slug = 'general-parent' AND gp.club_id = fc.club_id AND gp.parent_category_id IS NULL;

UPDATE public.forum_categories
SET display_order = 2
WHERE slug = 'marketplace' AND club_id IS NOT NULL AND parent_category_id IS NULL;

NOTIFY pgrst, 'reload schema';
