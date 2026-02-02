-- =============================================================================
-- GameTaverns Self-Hosted: Core Tables
-- Version: 2.3.2 - Schema Parity Audit
-- Audited: 2026-02-02
-- =============================================================================

-- ===========================================
-- User Profiles (extends auth.users)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    display_name TEXT,
    username TEXT UNIQUE,
    avatar_url TEXT,
    bio TEXT,
    discord_id TEXT,
    discord_username TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- User Roles (admin, moderator)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

-- ===========================================
-- Libraries (tenants)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.libraries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    custom_domain TEXT UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_premium BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_libraries_slug ON public.libraries(slug);
CREATE INDEX IF NOT EXISTS idx_libraries_owner ON public.libraries(owner_id);

-- ===========================================
-- Library Settings
-- ===========================================
CREATE TABLE IF NOT EXISTS public.library_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL UNIQUE REFERENCES public.libraries(id) ON DELETE CASCADE,
    
    -- Feature flags
    feature_ratings BOOLEAN DEFAULT true,
    feature_wishlist BOOLEAN DEFAULT true,
    feature_for_sale BOOLEAN DEFAULT true,
    feature_messaging BOOLEAN DEFAULT true,
    feature_lending BOOLEAN DEFAULT true,
    feature_achievements BOOLEAN DEFAULT true,
    feature_events BOOLEAN DEFAULT true,
    feature_play_logs BOOLEAN DEFAULT true,
    feature_coming_soon BOOLEAN DEFAULT true,
    
    -- Branding
    logo_url TEXT,
    background_image_url TEXT,
    background_overlay_opacity TEXT DEFAULT '0.85',
    footer_text TEXT,
    
    -- Theme (light mode)
    theme_primary_h TEXT DEFAULT '25',
    theme_primary_s TEXT DEFAULT '95%',
    theme_primary_l TEXT DEFAULT '50%',
    theme_accent_h TEXT DEFAULT '25',
    theme_accent_s TEXT DEFAULT '90%',
    theme_accent_l TEXT DEFAULT '40%',
    theme_background_h TEXT DEFAULT '40',
    theme_background_s TEXT DEFAULT '30%',
    theme_background_l TEXT DEFAULT '95%',
    theme_card_h TEXT DEFAULT '40',
    theme_card_s TEXT DEFAULT '25%',
    theme_card_l TEXT DEFAULT '92%',
    theme_sidebar_h TEXT DEFAULT '25',
    theme_sidebar_s TEXT DEFAULT '30%',
    theme_sidebar_l TEXT DEFAULT '20%',
    
    -- Theme (dark mode)
    theme_dark_primary_h TEXT DEFAULT '25',
    theme_dark_primary_s TEXT DEFAULT '95%',
    theme_dark_primary_l TEXT DEFAULT '60%',
    theme_dark_accent_h TEXT DEFAULT '25',
    theme_dark_accent_s TEXT DEFAULT '90%',
    theme_dark_accent_l TEXT DEFAULT '50%',
    theme_dark_background_h TEXT DEFAULT '25',
    theme_dark_background_s TEXT DEFAULT '20%',
    theme_dark_background_l TEXT DEFAULT '10%',
    theme_dark_card_h TEXT DEFAULT '25',
    theme_dark_card_s TEXT DEFAULT '15%',
    theme_dark_card_l TEXT DEFAULT '15%',
    theme_dark_sidebar_h TEXT DEFAULT '25',
    theme_dark_sidebar_s TEXT DEFAULT '20%',
    theme_dark_sidebar_l TEXT DEFAULT '8%',
    
    -- Fonts
    theme_font_display TEXT DEFAULT 'Cinzel',
    theme_font_body TEXT DEFAULT 'Lora',
    
    -- Social links
    contact_email TEXT,
    twitter_handle TEXT,
    instagram_url TEXT,
    facebook_url TEXT,
    discord_url TEXT,
    
    -- Discord integration
    discord_webhook_url TEXT,
    discord_events_channel_id TEXT,
    discord_notifications JSONB DEFAULT '{"game_added": true, "poll_closed": true, "poll_created": true, "wishlist_vote": true, "message_received": true}'::jsonb,
    
    -- Lending
    allow_lending BOOLEAN NOT NULL DEFAULT false,
    lending_terms TEXT,
    
    -- Discovery
    is_discoverable BOOLEAN NOT NULL DEFAULT true,
    
    -- Bot protection
    turnstile_site_key TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- Library Members
-- ===========================================
CREATE TABLE IF NOT EXISTS public.library_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role library_member_role NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(library_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_library_members_library ON public.library_members(library_id);
CREATE INDEX IF NOT EXISTS idx_library_members_user ON public.library_members(user_id);

-- ===========================================
-- Library Followers
-- ===========================================
CREATE TABLE IF NOT EXISTS public.library_followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
    follower_user_id UUID NOT NULL,
    followed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(library_id, follower_user_id)
);

-- ===========================================
-- Publishers
-- ===========================================
CREATE TABLE IF NOT EXISTS public.publishers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    website TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ===========================================
-- Mechanics
-- ===========================================
CREATE TABLE IF NOT EXISTS public.mechanics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);
