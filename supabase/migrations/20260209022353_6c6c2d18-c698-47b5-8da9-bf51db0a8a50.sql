-- Add feature flag for library community forums
ALTER TABLE public.library_settings 
ADD COLUMN IF NOT EXISTS feature_community_forum boolean DEFAULT true;

-- Forum categories table (site-wide when library_id is NULL, library-specific otherwise)
CREATE TABLE public.forum_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    icon text DEFAULT 'MessageSquare',
    color text DEFAULT 'blue',
    display_order integer DEFAULT 0,
    library_id uuid REFERENCES public.libraries(id) ON DELETE CASCADE,
    created_by uuid,
    is_system boolean DEFAULT false,
    is_archived boolean DEFAULT false,
    rules text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(slug, library_id)
);

-- Forum threads table
CREATE TABLE public.forum_threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid NOT NULL REFERENCES public.forum_categories(id) ON DELETE CASCADE,
    title text NOT NULL,
    content text NOT NULL,
    author_id uuid NOT NULL,
    is_pinned boolean DEFAULT false,
    is_locked boolean DEFAULT false,
    view_count integer DEFAULT 0,
    reply_count integer DEFAULT 0,
    last_reply_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Forum replies table
CREATE TABLE public.forum_replies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id uuid NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
    content text NOT NULL,
    author_id uuid NOT NULL,
    parent_reply_id uuid REFERENCES public.forum_replies(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_forum_categories_library ON public.forum_categories(library_id);
CREATE INDEX idx_forum_categories_slug ON public.forum_categories(slug);
CREATE INDEX idx_forum_threads_category ON public.forum_threads(category_id);
CREATE INDEX idx_forum_threads_author ON public.forum_threads(author_id);
CREATE INDEX idx_forum_threads_last_reply ON public.forum_threads(last_reply_at DESC);
CREATE INDEX idx_forum_replies_thread ON public.forum_replies(thread_id);
CREATE INDEX idx_forum_replies_author ON public.forum_replies(author_id);

-- Enable RLS
ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user can access a forum category
CREATE OR REPLACE FUNCTION public.can_access_forum_category(_user_id uuid, _category_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

-- Helper function: check if user can manage forum category
CREATE OR REPLACE FUNCTION public.can_manage_forum_category(_user_id uuid, _category_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

-- RLS Policies for forum_categories
CREATE POLICY "Anyone can view non-archived categories"
ON public.forum_categories FOR SELECT
USING (
    is_archived = false
    AND (
        library_id IS NULL 
        OR public.is_library_member(auth.uid(), library_id)
        OR EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
    )
);

CREATE POLICY "Platform admins can manage site-wide categories"
ON public.forum_categories FOR ALL
TO authenticated
USING (library_id IS NULL AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (library_id IS NULL AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Library owners can manage their categories"
ON public.forum_categories FOR ALL
TO authenticated
USING (
    library_id IS NOT NULL 
    AND EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
)
WITH CHECK (
    library_id IS NOT NULL 
    AND EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
);

-- RLS Policies for forum_threads
CREATE POLICY "Users can view threads in accessible categories"
ON public.forum_threads FOR SELECT
TO authenticated
USING (public.can_access_forum_category(auth.uid(), category_id));

CREATE POLICY "Users can create threads in accessible categories"
ON public.forum_threads FOR INSERT
TO authenticated
WITH CHECK (
    public.can_access_forum_category(auth.uid(), category_id)
    AND author_id = auth.uid()
);

CREATE POLICY "Authors can update their own threads"
ON public.forum_threads FOR UPDATE
TO authenticated
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors and moderators can delete threads"
ON public.forum_threads FOR DELETE
TO authenticated
USING (
    author_id = auth.uid()
    OR public.can_manage_forum_category(auth.uid(), category_id)
);

-- RLS Policies for forum_replies
CREATE POLICY "Users can view replies in accessible threads"
ON public.forum_replies FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.forum_threads ft
        WHERE ft.id = thread_id
        AND public.can_access_forum_category(auth.uid(), ft.category_id)
    )
);

CREATE POLICY "Users can create replies in unlocked threads"
ON public.forum_replies FOR INSERT
TO authenticated
WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.forum_threads ft
        WHERE ft.id = thread_id
        AND ft.is_locked = false
        AND public.can_access_forum_category(auth.uid(), ft.category_id)
    )
);

CREATE POLICY "Authors can update their own replies"
ON public.forum_replies FOR UPDATE
TO authenticated
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors and moderators can delete replies"
ON public.forum_replies FOR DELETE
TO authenticated
USING (
    author_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.forum_threads ft
        WHERE ft.id = thread_id
        AND public.can_manage_forum_category(auth.uid(), ft.category_id)
    )
);

-- Trigger to update reply_count and last_reply_at on thread
CREATE OR REPLACE FUNCTION public.update_thread_reply_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE TRIGGER trigger_update_thread_reply_stats
AFTER INSERT OR DELETE ON public.forum_replies
FOR EACH ROW
EXECUTE FUNCTION public.update_thread_reply_stats();

-- Updated_at triggers
CREATE TRIGGER update_forum_categories_updated_at
BEFORE UPDATE ON public.forum_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_forum_threads_updated_at
BEFORE UPDATE ON public.forum_threads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_forum_replies_updated_at
BEFORE UPDATE ON public.forum_replies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();