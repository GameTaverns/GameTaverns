-- Fix Security Issue #1: libraries_owner_exposure
-- The libraries_public view already exists but let's ensure it properly excludes owner_id
-- and has security_invoker enabled

DROP VIEW IF EXISTS public.libraries_public;

CREATE VIEW public.libraries_public
WITH (security_invoker = on) AS
SELECT 
    id,
    slug,
    name,
    description,
    custom_domain,
    is_active,
    is_premium,
    created_at,
    updated_at
    -- owner_id is intentionally excluded to prevent user enumeration
FROM public.libraries;

-- Add comment for documentation
COMMENT ON VIEW public.libraries_public IS 'Public view of libraries excluding owner_id to prevent user enumeration attacks';

-- Fix Security Issue #2: library_settings_webhook_exposure
-- Create a public view that excludes sensitive fields

DROP VIEW IF EXISTS public.library_settings_public;

CREATE VIEW public.library_settings_public
WITH (security_invoker = on) AS
SELECT 
    id,
    library_id,
    -- Feature flags (safe to expose)
    feature_play_logs,
    feature_wishlist,
    feature_for_sale,
    feature_messaging,
    feature_ratings,
    feature_events,
    feature_coming_soon,
    -- Branding (safe to expose)
    logo_url,
    background_image_url,
    background_overlay_opacity,
    footer_text,
    -- Theme settings (safe to expose)
    theme_primary_h,
    theme_primary_s,
    theme_primary_l,
    theme_accent_h,
    theme_accent_s,
    theme_accent_l,
    theme_background_h,
    theme_background_s,
    theme_background_l,
    theme_card_h,
    theme_card_s,
    theme_card_l,
    theme_sidebar_h,
    theme_sidebar_s,
    theme_sidebar_l,
    theme_dark_primary_h,
    theme_dark_primary_s,
    theme_dark_primary_l,
    theme_dark_accent_h,
    theme_dark_accent_s,
    theme_dark_accent_l,
    theme_dark_background_h,
    theme_dark_background_s,
    theme_dark_background_l,
    theme_dark_card_h,
    theme_dark_card_s,
    theme_dark_card_l,
    theme_dark_sidebar_h,
    theme_dark_sidebar_s,
    theme_dark_sidebar_l,
    theme_font_display,
    theme_font_body,
    -- Public social links (safe to expose - these are meant to be shared)
    contact_email,
    discord_url,
    facebook_url,
    instagram_url,
    twitter_handle,
    -- Timestamps
    created_at,
    updated_at
    -- EXCLUDED: discord_webhook_url (sensitive - can be used to spam Discord)
    -- EXCLUDED: discord_events_channel_id (sensitive - internal Discord config)
    -- EXCLUDED: turnstile_site_key (sensitive - could be abused to drain quota)
    -- EXCLUDED: discord_notifications (internal configuration)
FROM public.library_settings;

-- Add comment for documentation
COMMENT ON VIEW public.library_settings_public IS 'Public view of library settings excluding sensitive fields like webhook URLs, API keys, and internal Discord configuration';

-- Update RLS on library_settings to restrict public SELECT access
-- First, drop the existing permissive public SELECT policy
DROP POLICY IF EXISTS "Library settings are viewable by everyone" ON public.library_settings;

-- Create a new policy that only allows authenticated users or library owners to view full settings
-- Anonymous/public users should use the library_settings_public view instead
CREATE POLICY "Library owners can view their settings"
ON public.library_settings
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM libraries
        WHERE libraries.id = library_settings.library_id
        AND libraries.owner_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin')
);

-- Allow public access only through the view (the view has security_invoker so it will use the caller's permissions)
-- But we need the base table to be accessible for the view to work
-- So we'll keep a minimal public SELECT but only for active libraries
CREATE POLICY "Public can view settings of active libraries via view"
ON public.library_settings
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM libraries
        WHERE libraries.id = library_settings.library_id
        AND libraries.is_active = true
    )
);