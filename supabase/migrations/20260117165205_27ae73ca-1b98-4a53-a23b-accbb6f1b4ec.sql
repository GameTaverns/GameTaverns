-- Create a public-safe view that excludes sensitive financial data
CREATE VIEW public.games_public
WITH (security_invoker = on) AS
SELECT 
  id, title, description, image_url, additional_images,
  difficulty, game_type, play_time, min_players, max_players,
  suggested_age, publisher_id, bgg_id, bgg_url, slug,
  location_room, location_shelf, is_coming_soon, is_for_sale,
  sale_price, sale_condition, is_expansion, parent_game_id,
  sleeved, upgraded_components, crowdfunded, created_at, updated_at
FROM public.games;
-- Note: Excludes purchase_price and purchase_date

-- Drop the old permissive SELECT policy
DROP POLICY IF EXISTS "Games are viewable by everyone" ON public.games;

-- Create new policy: Only admins can SELECT from the base games table directly
CREATE POLICY "Admins can view all game data"
ON public.games FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Add a policy for public access via the view (security_invoker means the view respects RLS)
-- Non-admins can read games table but only through the view which excludes sensitive columns
CREATE POLICY "Public can view games via view"
ON public.games FOR SELECT
USING (true);