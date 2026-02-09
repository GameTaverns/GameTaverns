-- Forum System Tables for Self-Hosted Stack
-- Migration: 22-forum-tables.sql

-- Add feature flag to library_settings if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'library_settings' 
        AND column_name = 'feature_community_forum'
    ) THEN
        ALTER TABLE public.library_settings 
        ADD COLUMN feature_community_forum boolean DEFAULT true;
    END IF;
END $$;

-- Forum Categories (site-wide when library_id is NULL, library-specific otherwise)
CREATE TABLE IF NOT EXISTS public.forum_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id uuid REFERENCES public.libraries(id) ON DELETE CASCADE,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    icon text,
    color text,
    display_order integer DEFAULT 0,
    is_system boolean DEFAULT false,
    is_archived boolean DEFAULT false,
    rules text,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Forum Threads
CREATE TABLE IF NOT EXISTS public.forum_threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid NOT NULL REFERENCES public.forum_categories(id) ON DELETE CASCADE,
    author_id uuid NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    is_pinned boolean DEFAULT false,
    is_locked boolean DEFAULT false,
    view_count integer DEFAULT 0,
    reply_count integer DEFAULT 0,
    last_reply_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Forum Replies
CREATE TABLE IF NOT EXISTS public.forum_replies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id uuid NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
    author_id uuid NOT NULL,
    parent_reply_id uuid REFERENCES public.forum_replies(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_forum_categories_library ON public.forum_categories(library_id);
CREATE INDEX IF NOT EXISTS idx_forum_categories_slug ON public.forum_categories(slug);
CREATE INDEX IF NOT EXISTS idx_forum_threads_category ON public.forum_threads(category_id);
CREATE INDEX IF NOT EXISTS idx_forum_threads_author ON public.forum_threads(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_threads_pinned ON public.forum_threads(is_pinned DESC, last_reply_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_forum_replies_thread ON public.forum_replies(thread_id);
CREATE INDEX IF NOT EXISTS idx_forum_replies_author ON public.forum_replies(author_id);

-- Enable RLS
ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;

-- Helper function: can user access a forum category?
CREATE OR REPLACE FUNCTION public.can_access_forum_category(_user_id uuid, _category_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.forum_categories fc
        WHERE fc.id = _category_id
        AND (
            -- Site-wide categories are accessible to all authenticated users
            fc.library_id IS NULL
            OR
            -- Library categories require membership or ownership
            public.is_library_member(_user_id, fc.library_id)
        )
        AND fc.is_archived = false
    )
$$;

-- Helper function: can user manage a forum category?
CREATE OR REPLACE FUNCTION public.can_manage_forum_category(_user_id uuid, _category_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.forum_categories fc
        WHERE fc.id = _category_id
        AND (
            -- Site-wide: only platform admins
            (fc.library_id IS NULL AND public.has_role(_user_id, 'admin'))
            OR
            -- Library-specific: library owner or moderator
            (fc.library_id IS NOT NULL AND (
                EXISTS (SELECT 1 FROM public.libraries WHERE id = fc.library_id AND owner_id = _user_id)
                OR public.is_library_moderator(_user_id, fc.library_id)
            ))
        )
    )
$$;

-- Trigger function to update thread reply stats
CREATE OR REPLACE FUNCTION public.update_thread_reply_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.forum_threads
        SET reply_count = reply_count + 1,
            last_reply_at = NEW.created_at,
            updated_at = now()
        WHERE id = NEW.thread_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.forum_threads
        SET reply_count = GREATEST(0, reply_count - 1),
            updated_at = now()
        WHERE id = OLD.thread_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- Create trigger for reply stats
DROP TRIGGER IF EXISTS update_thread_reply_stats_trigger ON public.forum_replies;
CREATE TRIGGER update_thread_reply_stats_trigger
    AFTER INSERT OR DELETE ON public.forum_replies
    FOR EACH ROW
    EXECUTE FUNCTION public.update_thread_reply_stats();

-- RLS Policies for forum_categories
DROP POLICY IF EXISTS "Anyone can view non-archived categories" ON public.forum_categories;
CREATE POLICY "Anyone can view non-archived categories"
    ON public.forum_categories FOR SELECT
    USING (
        is_archived = false
        AND (
            library_id IS NULL
            OR public.is_library_member(auth.uid(), library_id)
        )
    );

DROP POLICY IF EXISTS "Admins and moderators can manage categories" ON public.forum_categories;
CREATE POLICY "Admins and moderators can manage categories"
    ON public.forum_categories FOR ALL
    USING (public.can_manage_forum_category(auth.uid(), id))
    WITH CHECK (public.can_manage_forum_category(auth.uid(), id));

-- RLS Policies for forum_threads
DROP POLICY IF EXISTS "Users can view threads in accessible categories" ON public.forum_threads;
CREATE POLICY "Users can view threads in accessible categories"
    ON public.forum_threads FOR SELECT
    USING (public.can_access_forum_category(auth.uid(), category_id));

DROP POLICY IF EXISTS "Authenticated users can create threads" ON public.forum_threads;
CREATE POLICY "Authenticated users can create threads"
    ON public.forum_threads FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND author_id = auth.uid()
        AND public.can_access_forum_category(auth.uid(), category_id)
    );

DROP POLICY IF EXISTS "Authors can update own threads" ON public.forum_threads;
CREATE POLICY "Authors can update own threads"
    ON public.forum_threads FOR UPDATE
    USING (
        author_id = auth.uid()
        OR public.can_manage_forum_category(auth.uid(), category_id)
    );

DROP POLICY IF EXISTS "Authors and moderators can delete threads" ON public.forum_threads;
CREATE POLICY "Authors and moderators can delete threads"
    ON public.forum_threads FOR DELETE
    USING (
        author_id = auth.uid()
        OR public.can_manage_forum_category(auth.uid(), category_id)
    );

-- RLS Policies for forum_replies
DROP POLICY IF EXISTS "Users can view replies in accessible threads" ON public.forum_replies;
CREATE POLICY "Users can view replies in accessible threads"
    ON public.forum_replies FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.forum_threads ft
            WHERE ft.id = thread_id
            AND public.can_access_forum_category(auth.uid(), ft.category_id)
        )
    );

DROP POLICY IF EXISTS "Authenticated users can create replies" ON public.forum_replies;
CREATE POLICY "Authenticated users can create replies"
    ON public.forum_replies FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND author_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.forum_threads ft
            WHERE ft.id = thread_id
            AND ft.is_locked = false
            AND public.can_access_forum_category(auth.uid(), ft.category_id)
        )
    );

DROP POLICY IF EXISTS "Authors can update own replies" ON public.forum_replies;
CREATE POLICY "Authors can update own replies"
    ON public.forum_replies FOR UPDATE
    USING (author_id = auth.uid());

DROP POLICY IF EXISTS "Authors and moderators can delete replies" ON public.forum_replies;
CREATE POLICY "Authors and moderators can delete replies"
    ON public.forum_replies FOR DELETE
    USING (
        author_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.forum_threads ft
            WHERE ft.id = thread_id
            AND public.can_manage_forum_category(auth.uid(), ft.category_id)
        )
    );

-- Seed default site-wide categories
INSERT INTO public.forum_categories (name, slug, description, icon, display_order, is_system, library_id)
VALUES 
    ('Announcements', 'announcements', 'Official platform announcements and updates', 'megaphone', 1, true, NULL),
    ('General Discussion', 'general', 'Chat about anything board game related', 'message-circle', 2, true, NULL),
    ('Looking for Group', 'lfg', 'Find players for your next game night', 'users', 3, true, NULL),
    ('Marketplace', 'marketplace', 'Buy, sell, and trade board games', 'shopping-bag', 4, true, NULL)
ON CONFLICT DO NOTHING;

-- Grant permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_replies TO authenticated;

-- Grant read-only to anon for public viewing
GRANT SELECT ON public.forum_categories TO anon;
GRANT SELECT ON public.forum_threads TO anon;
GRANT SELECT ON public.forum_replies TO anon;
