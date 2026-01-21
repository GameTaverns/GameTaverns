-- Fix Issue 1: Improve site_settings RLS policy by removing the public policy
-- The site_settings_public VIEW already handles public access properly
-- Remove the potentially bypassable RLS policy on the table
DROP POLICY IF EXISTS "Public can view non-sensitive site settings" ON public.site_settings;

-- Fix Issue 2: Remove the overly permissive public SELECT policy on games table
-- The games_public VIEW already handles public access properly
DROP POLICY IF EXISTS "Public can view games via public view" ON public.games;