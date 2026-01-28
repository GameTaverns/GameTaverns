-- Create libraries table for multi-tenant support
CREATE TABLE public.libraries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_premium BOOLEAN NOT NULL DEFAULT false,
    custom_domain TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$')
);

-- Create library_settings table for per-library customization
CREATE TABLE public.library_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE UNIQUE,
    -- Light mode theme
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
    -- Dark mode theme
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
    -- Typography
    theme_font_display TEXT DEFAULT 'Cinzel',
    theme_font_body TEXT DEFAULT 'Lora',
    -- Background image
    background_image_url TEXT,
    background_overlay_opacity TEXT DEFAULT '0.85',
    -- Logo
    logo_url TEXT,
    -- Feature flags (per-library)
    feature_play_logs BOOLEAN DEFAULT true,
    feature_wishlist BOOLEAN DEFAULT true,
    feature_for_sale BOOLEAN DEFAULT true,
    feature_messaging BOOLEAN DEFAULT true,
    feature_coming_soon BOOLEAN DEFAULT true,
    feature_ratings BOOLEAN DEFAULT true,
    -- Turnstile (for contact forms)
    turnstile_site_key TEXT,
    -- Footer
    footer_text TEXT,
    -- Social links
    twitter_handle TEXT,
    instagram_url TEXT,
    facebook_url TEXT,
    discord_url TEXT,
    contact_email TEXT,
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_profiles table for platform-level user data
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Libraries policies
CREATE POLICY "Libraries are viewable by everyone"
ON public.libraries FOR SELECT
USING (is_active = true);

CREATE POLICY "Owners can manage their libraries"
ON public.libraries FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Library settings policies
CREATE POLICY "Library settings are viewable by everyone"
ON public.library_settings FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.libraries 
    WHERE id = library_id AND is_active = true
));

CREATE POLICY "Library owners can manage settings"
ON public.library_settings FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.libraries 
    WHERE id = library_id AND owner_id = auth.uid()
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.libraries 
    WHERE id = library_id AND owner_id = auth.uid()
));

-- User profiles policies
CREATE POLICY "Profiles are viewable by everyone"
ON public.user_profiles FOR SELECT
USING (true);

CREATE POLICY "Users can manage their own profile"
ON public.user_profiles FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create function to auto-create library settings when library is created
CREATE OR REPLACE FUNCTION public.create_library_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.library_settings (library_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for auto-creating library settings
CREATE TRIGGER on_library_created
AFTER INSERT ON public.libraries
FOR EACH ROW
EXECUTE FUNCTION public.create_library_settings();

-- Create function to auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for auto-creating user profile
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_user_profile();

-- Update timestamps trigger
CREATE TRIGGER update_libraries_updated_at
BEFORE UPDATE ON public.libraries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_library_settings_updated_at
BEFORE UPDATE ON public.library_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check if slug is available
CREATE OR REPLACE FUNCTION public.is_slug_available(check_slug TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT NOT EXISTS (
        SELECT 1 FROM public.libraries WHERE slug = lower(check_slug)
    );
$$;