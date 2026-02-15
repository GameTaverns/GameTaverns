-- Seed default site-wide forum categories (fix for self-hosted)
-- Migration: 24-seed-forum-categories.sql
--
-- The original migration used ON CONFLICT DO NOTHING without a proper unique constraint,
-- so the seed data may not have been inserted. This migration ensures the categories exist.

-- First, add a unique constraint to prevent duplicate slugs within the same scope
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'forum_categories_library_slug_unique'
    ) THEN
        -- Use a partial unique index for site-wide (NULL library_id) and regular unique for library-specific
        CREATE UNIQUE INDEX forum_categories_library_slug_unique 
        ON public.forum_categories (COALESCE(library_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);
    END IF;
END $$;

-- Insert default site-wide categories if they don't exist
INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id)
SELECT 'Announcements', 'announcements', 'Official platform announcements and updates', 'Megaphone', 'amber', 1, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.forum_categories WHERE slug = 'announcements' AND library_id IS NULL);

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id)
SELECT 'General Discussion', 'general', 'Chat about anything board game related', 'MessageSquare', 'blue', 2, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.forum_categories WHERE slug = 'general' AND library_id IS NULL);

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id)
SELECT 'Looking for Group', 'lfg', 'Find players for your next game night', 'Users', 'green', 3, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.forum_categories WHERE slug = 'lfg' AND library_id IS NULL);

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id)
SELECT 'Marketplace', 'marketplace', 'Buy, sell, and trade board games', 'ShoppingBag', 'purple', 4, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.forum_categories WHERE slug = 'marketplace' AND library_id IS NULL);

INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order, is_system, library_id)
SELECT 'Introduce Yourself', 'introductions', 'Say hello and tell us about yourself', 'UserPlus', 'cyan', 5, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.forum_categories WHERE slug = 'introductions' AND library_id IS NULL);

-- Verify categories were created
DO $$
DECLARE
    cat_count integer;
BEGIN
    SELECT COUNT(*) INTO cat_count FROM public.forum_categories WHERE library_id IS NULL;
    RAISE NOTICE 'Site-wide forum categories count: %', cat_count;
END $$;
