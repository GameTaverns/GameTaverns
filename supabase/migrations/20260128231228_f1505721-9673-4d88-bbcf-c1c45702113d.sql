-- =====================================================
-- SECURITY FIX: Password Reset Tokens Protection
-- =====================================================
-- The password_reset_tokens table contains sensitive data (tokens, emails)
-- and should ONLY be accessed via edge functions with service role.
-- Add a policy that denies all direct access to prevent token theft.

-- First, drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can manage tokens" ON public.password_reset_tokens;

-- Create a restrictive policy that denies all direct access
-- Edge functions use service role which bypasses RLS anyway
CREATE POLICY "Deny all direct access to reset tokens"
ON public.password_reset_tokens
AS RESTRICTIVE
FOR ALL
USING (false)
WITH CHECK (false);

-- =====================================================
-- SECURITY FIX: Libraries Table - Hide owner_id from public
-- =====================================================
-- The libraries_public view already exists and excludes owner_id
-- But we need to ensure the base table isn't directly accessible for public reads
-- Update the existing view to ensure it uses security_invoker

DROP VIEW IF EXISTS public.libraries_public;

CREATE VIEW public.libraries_public
WITH (security_invoker=on) AS
SELECT 
  id,
  name,
  slug,
  description,
  custom_domain,
  is_active,
  is_premium,
  created_at,
  updated_at
  -- Explicitly EXCLUDING owner_id to prevent user enumeration
FROM public.libraries
WHERE is_active = true;

-- Grant select on the view
GRANT SELECT ON public.libraries_public TO anon, authenticated;

-- Add comment documenting the security decision
COMMENT ON VIEW public.libraries_public IS 'Public view of libraries excluding owner_id to prevent user enumeration attacks';

-- =====================================================
-- SECURITY FIX: User Profiles - Create public view without user_id
-- =====================================================
-- Create a public-facing view that excludes user_id
-- The user_id is internal and should not be exposed for enumeration

CREATE VIEW public.user_profiles_public
WITH (security_invoker=on) AS
SELECT 
  id,  -- This is the profile ID, not the user_id
  display_name,
  avatar_url,
  bio,
  created_at,
  updated_at
  -- Explicitly EXCLUDING user_id to prevent account enumeration
FROM public.user_profiles;

-- Grant select on the view  
GRANT SELECT ON public.user_profiles_public TO anon, authenticated;

-- Add comment documenting the security decision
COMMENT ON VIEW public.user_profiles_public IS 'Public view of user profiles excluding user_id to prevent account enumeration attacks';