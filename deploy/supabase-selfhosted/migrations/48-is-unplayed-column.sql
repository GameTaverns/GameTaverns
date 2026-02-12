-- Add is_unplayed flag to games table
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS is_unplayed BOOLEAN NOT NULL DEFAULT false;

-- Update games_public view to include the new column
DROP VIEW IF EXISTS public.games_public;
CREATE VIEW public.games_public AS
SELECT
  id, library_id, title, slug, description, image_url, additional_images,
  min_players, max_players, play_time, difficulty, game_type, suggested_age,
  bgg_id, bgg_url, publisher_id, is_expansion, parent_game_id,
  is_favorite, is_for_sale, is_coming_soon, is_unplayed,
  sale_price, sale_condition,
  sleeved, inserts, upgraded_components, crowdfunded, in_base_game_box,
  genre, youtube_videos, copies_owned,
  created_at, updated_at
FROM public.games;

GRANT SELECT ON public.games_public TO anon, authenticated;
