-- =============================================================================
-- GameTaverns Self-Hosted: Clubs Feature
-- Version: 2.5.0
-- =============================================================================

-- Clubs table
CREATE TABLE IF NOT EXISTS public.clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    logo_url TEXT,
    owner_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    is_public BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clubs_slug ON public.clubs(slug);
CREATE INDEX IF NOT EXISTS idx_clubs_owner ON public.clubs(owner_id);
CREATE INDEX IF NOT EXISTS idx_clubs_status ON public.clubs(status);

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

-- Club-Libraries join table
CREATE TABLE IF NOT EXISTS public.club_libraries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(club_id, library_id)
);

CREATE INDEX IF NOT EXISTS idx_club_libraries_club ON public.club_libraries(club_id);
CREATE INDEX IF NOT EXISTS idx_club_libraries_library ON public.club_libraries(library_id);

ALTER TABLE public.club_libraries ENABLE ROW LEVEL SECURITY;

-- Club invite codes
CREATE TABLE IF NOT EXISTS public.club_invite_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    created_by UUID NOT NULL,
    max_uses INTEGER,
    uses INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.club_invite_codes ENABLE ROW LEVEL SECURITY;

-- Club events
CREATE TABLE IF NOT EXISTS public.club_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    event_location TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_events_club ON public.club_events(club_id);
CREATE INDEX IF NOT EXISTS idx_club_events_date ON public.club_events(event_date);

ALTER TABLE public.club_events ENABLE ROW LEVEL SECURITY;

-- Add club_id to forum_categories for club-scoped forums
ALTER TABLE public.forum_categories ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE;

-- =============================================================================
-- Helper Functions
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_club_owner(_user_id UUID, _club_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.clubs
        WHERE id = _club_id AND owner_id = _user_id
    )
$$;

CREATE OR REPLACE FUNCTION public.is_club_member(_user_id UUID, _club_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.club_libraries cl
        JOIN public.libraries l ON l.id = cl.library_id
        WHERE cl.club_id = _club_id
        AND (l.owner_id = _user_id OR EXISTS (
            SELECT 1 FROM public.library_members lm
            WHERE lm.library_id = l.id AND lm.user_id = _user_id
        ))
    ) OR public.is_club_owner(_user_id, _club_id)
$$;

-- =============================================================================
-- RLS Policies: clubs
-- =============================================================================

CREATE POLICY "Anyone can view approved public clubs"
ON public.clubs FOR SELECT
USING (status = 'approved' AND is_public = true AND is_active = true);

CREATE POLICY "Club members can view their clubs"
ON public.clubs FOR SELECT
USING (is_club_member(auth.uid(), id));

CREATE POLICY "Club owners can view their clubs"
ON public.clubs FOR SELECT
USING (owner_id = auth.uid());

CREATE POLICY "Admins can view all clubs"
ON public.clubs FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can request clubs"
ON public.clubs FOR INSERT
WITH CHECK (auth.uid() = owner_id AND status = 'pending');

CREATE POLICY "Club owners can update their approved clubs"
ON public.clubs FOR UPDATE
USING (auth.uid() = owner_id AND status = 'approved');

CREATE POLICY "Admins can manage all clubs"
ON public.clubs FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- =============================================================================
-- RLS Policies: club_libraries
-- =============================================================================

CREATE POLICY "Club members can view club libraries"
ON public.club_libraries FOR SELECT
USING (is_club_member(auth.uid(), club_id));

CREATE POLICY "Public club libraries are viewable"
ON public.club_libraries FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id = club_id AND c.is_public = true AND c.status = 'approved' AND c.is_active = true
));

CREATE POLICY "Club owners can manage club libraries"
ON public.club_libraries FOR ALL
USING (is_club_owner(auth.uid(), club_id))
WITH CHECK (is_club_owner(auth.uid(), club_id));

CREATE POLICY "Library owners can remove their own library"
ON public.club_libraries FOR DELETE
USING (EXISTS (
    SELECT 1 FROM public.libraries l
    WHERE l.id = library_id AND l.owner_id = auth.uid()
));

CREATE POLICY "Admins can manage club libraries"
ON public.club_libraries FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- =============================================================================
-- RLS Policies: club_invite_codes
-- =============================================================================

CREATE POLICY "Club owners can manage invite codes"
ON public.club_invite_codes FOR ALL
USING (is_club_owner(auth.uid(), club_id))
WITH CHECK (is_club_owner(auth.uid(), club_id));

CREATE POLICY "Admins can manage invite codes"
ON public.club_invite_codes FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- =============================================================================
-- RLS Policies: club_events
-- =============================================================================

CREATE POLICY "Club members can view club events"
ON public.club_events FOR SELECT
USING (is_club_member(auth.uid(), club_id));

CREATE POLICY "Public club events are viewable"
ON public.club_events FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id = club_id AND c.is_public = true AND c.status = 'approved' AND c.is_active = true
));

CREATE POLICY "Club owners can manage events"
ON public.club_events FOR ALL
USING (is_club_owner(auth.uid(), club_id))
WITH CHECK (is_club_owner(auth.uid(), club_id));

CREATE POLICY "Admins can manage club events"
ON public.club_events FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- =============================================================================
-- Triggers
-- =============================================================================

CREATE TRIGGER update_clubs_updated_at
BEFORE UPDATE ON public.clubs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_club_events_updated_at
BEFORE UPDATE ON public.club_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- Update forum access functions for club-scoped categories
-- =============================================================================

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
            fc.library_id IS NULL AND fc.club_id IS NULL
            OR
            fc.library_id IS NOT NULL AND public.is_library_member(_user_id, fc.library_id)
            OR
            fc.club_id IS NOT NULL AND public.is_club_member(_user_id, fc.club_id)
        )
        AND fc.is_archived = false
    )
$$;

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
            (fc.library_id IS NULL AND fc.club_id IS NULL AND public.has_role(_user_id, 'admin'))
            OR
            (fc.library_id IS NOT NULL AND (
                EXISTS (SELECT 1 FROM public.libraries WHERE id = fc.library_id AND owner_id = _user_id)
                OR public.is_library_moderator(_user_id, fc.library_id)
            ))
            OR
            (fc.club_id IS NOT NULL AND public.is_club_owner(_user_id, fc.club_id))
        )
    )
$$;
