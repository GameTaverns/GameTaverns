-- Add library_id to games table for multi-tenancy
ALTER TABLE public.games ADD COLUMN library_id uuid REFERENCES public.libraries(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX idx_games_library_id ON public.games(library_id);

-- Drop existing RLS policies on games
DROP POLICY IF EXISTS "Admins can delete games" ON public.games;
DROP POLICY IF EXISTS "Admins can insert games" ON public.games;
DROP POLICY IF EXISTS "Admins can update games" ON public.games;
DROP POLICY IF EXISTS "Admins can view all game data" ON public.games;

-- Create new RLS policies for library owners
CREATE POLICY "Library owners can view their games"
ON public.games FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.libraries 
    WHERE libraries.id = games.library_id 
    AND libraries.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Library owners can insert games"
ON public.games FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.libraries 
    WHERE libraries.id = library_id 
    AND libraries.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Library owners can update their games"
ON public.games FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.libraries 
    WHERE libraries.id = games.library_id 
    AND libraries.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Library owners can delete their games"
ON public.games FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.libraries 
    WHERE libraries.id = games.library_id 
    AND libraries.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Update games_public view to include library_id
DROP VIEW IF EXISTS public.games_public;
CREATE VIEW public.games_public
WITH (security_invoker=on) AS
SELECT 
  id, title, slug, description, image_url, additional_images, youtube_videos,
  bgg_id, bgg_url, min_players, max_players, play_time, difficulty, game_type,
  publisher_id, is_coming_soon, is_for_sale, sale_price, sale_condition,
  is_expansion, parent_game_id, sleeved, upgraded_components, crowdfunded,
  in_base_game_box, inserts, location_room, location_shelf, location_misc,
  suggested_age, created_at, updated_at, library_id
FROM public.games;

-- Create public read policy for games (visitors can see games in active libraries)
CREATE POLICY "Public can view games in active libraries"
ON public.games FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.libraries 
    WHERE libraries.id = games.library_id 
    AND libraries.is_active = true
  )
);