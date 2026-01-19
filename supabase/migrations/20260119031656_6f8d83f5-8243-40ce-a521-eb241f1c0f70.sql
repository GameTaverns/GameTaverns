
-- Fix #1: Recreate games_public view with security_invoker=on
-- Also remove location_room and location_shelf which were still exposed
DROP VIEW IF EXISTS public.games_public;

CREATE VIEW public.games_public
WITH (security_invoker=on) AS
SELECT 
  id,
  title,
  slug,
  description,
  image_url,
  additional_images,
  youtube_videos,
  bgg_id,
  bgg_url,
  min_players,
  max_players,
  play_time,
  difficulty,
  game_type,
  publisher_id,
  suggested_age,
  is_coming_soon,
  is_for_sale,
  sale_price,
  sale_condition,
  is_expansion,
  parent_game_id,
  in_base_game_box,
  sleeved,
  upgraded_components,
  crowdfunded,
  created_at,
  updated_at
  -- EXCLUDED for security: location_room, location_shelf, location_misc, inserts
FROM public.games;

-- Add SELECT policy for anon/authenticated on games table to allow the view to work
CREATE POLICY "Public can view games via public view" 
ON public.games FOR SELECT 
USING (true);

-- Fix #2: Recreate site_settings_public view with security_invoker=on
DROP VIEW IF EXISTS public.site_settings_public;

CREATE VIEW public.site_settings_public
WITH (security_invoker=on) AS
SELECT 
  id,
  key,
  value,
  created_at,
  updated_at
FROM public.site_settings
WHERE key NOT IN (
  'contact_email',
  'turnstile_site_key', 
  'smtp_password',
  'api_key',
  'PII_ENCRYPTION_KEY'
);

-- Add SELECT policy for public on site_settings for the view to work
CREATE POLICY "Public can view non-sensitive site settings" 
ON public.site_settings FOR SELECT 
USING (
  key NOT IN (
    'contact_email',
    'turnstile_site_key',
    'smtp_password',
    'api_key', 
    'PII_ENCRYPTION_KEY'
  )
);

-- Fix #3: Ensure user_roles table only allows users to see their own roles
-- First drop any overly permissive policies
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Recreate with proper restrictions
CREATE POLICY "Users can only view their own roles" 
ON public.user_roles FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" 
ON public.user_roles FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
