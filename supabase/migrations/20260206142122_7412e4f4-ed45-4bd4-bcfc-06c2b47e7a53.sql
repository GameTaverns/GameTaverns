-- Add missing RLS policies for follow/join + owner updates

-- 1) library_followers: allow authenticated users to follow/unfollow and read their own follows
ALTER TABLE public.library_followers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- SELECT own follows
  CREATE POLICY "Users can view their own library follows"
  ON public.library_followers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = follower_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- INSERT follow
  CREATE POLICY "Users can follow active libraries"
  ON public.library_followers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = follower_user_id
    AND EXISTS (
      SELECT 1 FROM public.libraries l
      WHERE l.id = library_followers.library_id
        AND l.is_active = true
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- DELETE unfollow
  CREATE POLICY "Users can unfollow libraries"
  ON public.library_followers
  FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 2) library_members: allow authenticated users to join/leave active libraries
ALTER TABLE public.library_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can join active libraries"
  ON public.library_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.libraries l
      WHERE l.id = library_members.library_id
        AND l.is_active = true
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can leave libraries"
  ON public.library_members
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 3) games: allow library owners to update favorite status on games in their library
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Library owners can update games in their library"
  ON public.games
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.libraries l
      WHERE l.id = games.library_id
        AND l.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.libraries l
      WHERE l.id = games.library_id
        AND l.owner_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 4) library_settings: allow library owners to update their settings (feature toggles)
ALTER TABLE public.library_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Library owners can update their library settings"
  ON public.library_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.libraries l
      WHERE l.id = library_settings.library_id
        AND l.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.libraries l
      WHERE l.id = library_settings.library_id
        AND l.owner_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
