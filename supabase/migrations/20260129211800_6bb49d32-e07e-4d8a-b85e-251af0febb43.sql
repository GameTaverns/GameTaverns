-- Add 'moderator' to app_role enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'moderator' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'moderator';
  END IF;
END $$;

-- Create library-level role enum for membership tiers
CREATE TYPE public.library_member_role AS ENUM ('member', 'moderator');

-- Create library_members table for community membership
CREATE TABLE public.library_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id uuid NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role library_member_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (library_id, user_id)
);

-- Create indexes for performance
CREATE INDEX idx_library_members_library ON public.library_members(library_id);
CREATE INDEX idx_library_members_user ON public.library_members(user_id);

-- Enable RLS
ALTER TABLE public.library_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for library_members
-- Anyone can view membership (for member counts, etc.)
CREATE POLICY "Anyone can view library members"
ON public.library_members FOR SELECT
USING (true);

-- Users can join libraries themselves
CREATE POLICY "Users can join libraries"
ON public.library_members FOR INSERT
WITH CHECK (auth.uid() = user_id AND role = 'member');

-- Users can leave libraries
CREATE POLICY "Users can leave libraries"
ON public.library_members FOR DELETE
USING (auth.uid() = user_id);

-- Library owners can manage members
CREATE POLICY "Library owners can manage members"
ON public.library_members FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.libraries 
    WHERE id = library_members.library_id 
    AND owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.libraries 
    WHERE id = library_members.library_id 
    AND owner_id = auth.uid()
  )
);

-- Admins can manage all members
CREATE POLICY "Admins can manage all members"
ON public.library_members FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create helper function to check library membership
CREATE OR REPLACE FUNCTION public.is_library_member(_user_id uuid, _library_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_members
    WHERE user_id = _user_id AND library_id = _library_id
  ) OR EXISTS (
    SELECT 1 FROM public.libraries
    WHERE id = _library_id AND owner_id = _user_id
  )
$$;

-- Create helper function to check if user is library moderator
CREATE OR REPLACE FUNCTION public.is_library_moderator(_user_id uuid, _library_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_members
    WHERE user_id = _user_id 
    AND library_id = _library_id 
    AND role = 'moderator'
  ) OR EXISTS (
    SELECT 1 FROM public.libraries
    WHERE id = _library_id AND owner_id = _user_id
  ) OR public.has_role(_user_id, 'admin')
$$;

-- Update game_loans: require membership to request loans
DROP POLICY IF EXISTS "Users can request loans" ON public.game_loans;
CREATE POLICY "Members can request loans"
ON public.game_loans FOR INSERT
WITH CHECK (
  borrower_user_id = auth.uid() 
  AND public.is_library_member(auth.uid(), library_id)
);

-- Update poll_votes: require membership to vote (get library_id via poll)
DROP POLICY IF EXISTS "Anyone can vote on open polls" ON public.poll_votes;
CREATE POLICY "Members can vote on open polls"
ON public.poll_votes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.game_polls gp
    WHERE gp.id = poll_votes.poll_id
    AND gp.status = 'open'
    AND public.is_library_member(auth.uid(), gp.library_id)
  )
);

-- Update game_night_rsvps: require membership
DROP POLICY IF EXISTS "Anyone can manage their own RSVP" ON public.game_night_rsvps;
CREATE POLICY "Members can manage their own RSVP"
ON public.game_night_rsvps FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.game_polls gp
    WHERE gp.id = game_night_rsvps.poll_id
    AND public.is_library_member(auth.uid(), gp.library_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.game_polls gp
    WHERE gp.id = game_night_rsvps.poll_id
    AND public.is_library_member(auth.uid(), gp.library_id)
  )
);

-- Create public view for member counts (exclude sensitive info)
CREATE OR REPLACE VIEW public.library_members_public
WITH (security_invoker = true) AS
SELECT 
  library_id,
  COUNT(*) as member_count
FROM public.library_members
GROUP BY library_id;

-- Add to library_directory view update
DROP VIEW IF EXISTS public.library_directory;
CREATE OR REPLACE VIEW public.library_directory
WITH (security_invoker = true) AS
SELECT 
  l.id,
  l.name,
  l.slug,
  l.description,
  l.created_at,
  ls.logo_url,
  ls.is_discoverable,
  ls.allow_lending,
  (SELECT COUNT(*) FROM public.games WHERE library_id = l.id) as game_count,
  (SELECT COUNT(*) FROM public.library_followers WHERE library_id = l.id) as follower_count,
  (SELECT COUNT(*) FROM public.library_members WHERE library_id = l.id) as member_count
FROM public.libraries l
LEFT JOIN public.library_settings ls ON ls.library_id = l.id
WHERE l.is_active = true;