-- Add parent_category_id column for subcategory nesting
ALTER TABLE public.forum_categories
ADD COLUMN IF NOT EXISTS parent_category_id uuid REFERENCES public.forum_categories(id) ON DELETE CASCADE;

-- Add index for fast child lookups
CREATE INDEX IF NOT EXISTS idx_forum_categories_parent
ON public.forum_categories (parent_category_id);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';