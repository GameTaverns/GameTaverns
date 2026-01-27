-- ============================================
-- Game Haven Application Schema
-- Creates all tables, views, functions, and RLS policies
-- ============================================
-- Create extensions schema if it doesn't exist (standalone deployments)
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA extensions;

-- ==========================================
-- ENUM TYPES
-- ==========================================

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.difficulty_level AS ENUM (
    '1 - Light',
    '2 - Medium Light',
    '3 - Medium',
    '4 - Medium Heavy',
    '5 - Heavy'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.game_type AS ENUM (
    'Board Game',
    'Card Game',
    'Dice Game',
    'Party Game',
    'War Game',
    'Miniatures',
    'RPG',
    'Other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.play_time AS ENUM (
    '0-15 Minutes',
    '15-30 Minutes',
    '30-45 Minutes',
    '45-60 Minutes',
    '60+ Minutes',
    '2+ Hours',
    '3+ Hours'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sale_condition AS ENUM (
    'New/Sealed',
    'Like New',
    'Very Good',
    'Good',
    'Acceptable'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==========================================
-- FUNCTIONS
-- ==========================================

-- Slugify function
CREATE OR REPLACE FUNCTION public.slugify(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public, extensions'
AS $$
  SELECT trim(both '-' from regexp_replace(
    regexp_replace(lower(extensions.unaccent(coalesce(input, ''))), '[^a-z0-9]+', '-', 'g'),
    '-{2,}', '-', 'g'
  ));
$$;

-- Generate slug function
CREATE OR REPLACE FUNCTION public.generate_slug(title text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  slug TEXT;
BEGIN
  slug := lower(title);
  slug := regexp_replace(slug, '[^a-z0-9\s-]', '', 'g');
  slug := regexp_replace(slug, '\s+', '-', 'g');
  slug := regexp_replace(slug, '-+', '-', 'g');
  slug := trim(both '-' from slug);
  RETURN slug;
END;
$$;

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Set game slug trigger function
CREATE OR REPLACE FUNCTION public.set_game_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.title);
  END IF;
  RETURN NEW;
END;
$$;

-- Games set slug function
CREATE OR REPLACE FUNCTION public.games_set_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    NEW.slug := public.slugify(NEW.title);
  END IF;
  RETURN NEW;
END;
$$;

-- Has role function (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- ==========================================
-- TABLES
-- ==========================================

-- Publishers
CREATE TABLE IF NOT EXISTS public.publishers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Mechanics
CREATE TABLE IF NOT EXISTS public.mechanics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Games
CREATE TABLE IF NOT EXISTS public.games (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    image_url text,
    additional_images text[] DEFAULT '{}'::text[],
    youtube_videos text[] DEFAULT '{}'::text[],
    difficulty public.difficulty_level DEFAULT '3 - Medium'::difficulty_level,
    game_type public.game_type DEFAULT 'Board Game'::game_type,
    play_time public.play_time DEFAULT '45-60 Minutes'::play_time,
    min_players integer DEFAULT 1,
    max_players integer DEFAULT 4,
    suggested_age text DEFAULT '10+'::text,
    publisher_id uuid REFERENCES public.publishers(id),
    bgg_id text,
    bgg_url text,
    slug text,
    is_coming_soon boolean NOT NULL DEFAULT false,
    is_for_sale boolean NOT NULL DEFAULT false,
    sale_price numeric,
    sale_condition public.sale_condition,
    is_expansion boolean NOT NULL DEFAULT false,
    parent_game_id uuid REFERENCES public.games(id),
    sleeved boolean DEFAULT false,
    upgraded_components boolean DEFAULT false,
    crowdfunded boolean DEFAULT false,
    in_base_game_box boolean DEFAULT false,
    inserts boolean DEFAULT false,
    location_room text,
    location_shelf text,
    location_misc text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Game Mechanics (junction table)
CREATE TABLE IF NOT EXISTS public.game_mechanics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    mechanic_id uuid NOT NULL REFERENCES public.mechanics(id) ON DELETE CASCADE,
    UNIQUE(game_id, mechanic_id)
);

-- Game Admin Data (private purchase info)
CREATE TABLE IF NOT EXISTS public.game_admin_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id uuid NOT NULL UNIQUE REFERENCES public.games(id) ON DELETE CASCADE,
    purchase_price numeric,
    purchase_date date,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Game Messages (encrypted contact messages)
CREATE TABLE IF NOT EXISTS public.game_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    sender_name_encrypted text,
    sender_email_encrypted text,
    sender_ip_encrypted text,
    message_encrypted text,
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Game Sessions (play logs)
CREATE TABLE IF NOT EXISTS public.game_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    played_at timestamp with time zone NOT NULL DEFAULT now(),
    duration_minutes integer,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Game Session Players
CREATE TABLE IF NOT EXISTS public.game_session_players (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    player_name text NOT NULL,
    score integer,
    is_winner boolean NOT NULL DEFAULT false,
    is_first_play boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Game Wishlist
CREATE TABLE IF NOT EXISTS public.game_wishlist (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    guest_identifier text NOT NULL,
    guest_name text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(game_id, guest_identifier)
);

-- Site Settings
CREATE TABLE IF NOT EXISTS public.site_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL UNIQUE,
    value text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- User Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

-- ==========================================
-- TRIGGERS
-- ==========================================

DROP TRIGGER IF EXISTS set_game_slug_trigger ON public.games;
CREATE TRIGGER set_game_slug_trigger
    BEFORE INSERT OR UPDATE ON public.games
    FOR EACH ROW
    EXECUTE FUNCTION public.games_set_slug();

DROP TRIGGER IF EXISTS update_games_updated_at ON public.games;
CREATE TRIGGER update_games_updated_at
    BEFORE UPDATE ON public.games
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_game_admin_data_updated_at ON public.game_admin_data;
CREATE TRIGGER update_game_admin_data_updated_at
    BEFORE UPDATE ON public.game_admin_data
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_game_sessions_updated_at ON public.game_sessions;
CREATE TRIGGER update_game_sessions_updated_at
    BEFORE UPDATE ON public.game_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_site_settings_updated_at ON public.site_settings;
CREATE TRIGGER update_site_settings_updated_at
    BEFORE UPDATE ON public.site_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- VIEWS
-- ==========================================

-- Public games view (excludes admin-only fields)
CREATE OR REPLACE VIEW public.games_public AS
SELECT
    id, title, description, image_url, additional_images, youtube_videos,
    difficulty, game_type, play_time, min_players, max_players,
    suggested_age, publisher_id, bgg_id, bgg_url, slug,
    is_coming_soon, is_for_sale, sale_price, sale_condition,
    is_expansion, parent_game_id, sleeved, upgraded_components,
    crowdfunded, in_base_game_box, created_at, updated_at
FROM public.games;

-- Public site settings view (for unauthenticated access)
CREATE OR REPLACE VIEW public.site_settings_public AS
SELECT id, key, value, created_at, updated_at
FROM public.site_settings
WHERE key NOT LIKE 'private_%';

-- Wishlist summary view
CREATE OR REPLACE VIEW public.game_wishlist_summary AS
SELECT
    game_id,
    COUNT(*) AS vote_count,
    COUNT(guest_name) AS named_votes
FROM public.game_wishlist
GROUP BY game_id;

-- ==========================================
-- ENABLE RLS
-- ==========================================

ALTER TABLE public.publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_mechanics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_admin_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_session_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- Publishers: public read, admin write
DROP POLICY IF EXISTS "Publishers are viewable by everyone" ON public.publishers;
CREATE POLICY "Publishers are viewable by everyone" ON public.publishers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert publishers" ON public.publishers;
CREATE POLICY "Admins can insert publishers" ON public.publishers FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update publishers" ON public.publishers;
CREATE POLICY "Admins can update publishers" ON public.publishers FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete publishers" ON public.publishers;
CREATE POLICY "Admins can delete publishers" ON public.publishers FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Mechanics: public read, admin write
DROP POLICY IF EXISTS "Mechanics are viewable by everyone" ON public.mechanics;
CREATE POLICY "Mechanics are viewable by everyone" ON public.mechanics FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert mechanics" ON public.mechanics;
CREATE POLICY "Admins can insert mechanics" ON public.mechanics FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update mechanics" ON public.mechanics;
CREATE POLICY "Admins can update mechanics" ON public.mechanics FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete mechanics" ON public.mechanics;
CREATE POLICY "Admins can delete mechanics" ON public.mechanics FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Games: admin only (public uses games_public view)
DROP POLICY IF EXISTS "Admins can view all game data" ON public.games;
CREATE POLICY "Admins can view all game data" ON public.games FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert games" ON public.games;
CREATE POLICY "Admins can insert games" ON public.games FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update games" ON public.games;
CREATE POLICY "Admins can update games" ON public.games FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete games" ON public.games;
CREATE POLICY "Admins can delete games" ON public.games FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Game Mechanics: public read, admin write
DROP POLICY IF EXISTS "Game mechanics are viewable by everyone" ON public.game_mechanics;
CREATE POLICY "Game mechanics are viewable by everyone" ON public.game_mechanics FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert game_mechanics" ON public.game_mechanics;
CREATE POLICY "Admins can insert game_mechanics" ON public.game_mechanics FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update game_mechanics" ON public.game_mechanics;
CREATE POLICY "Admins can update game_mechanics" ON public.game_mechanics FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete game_mechanics" ON public.game_mechanics;
CREATE POLICY "Admins can delete game_mechanics" ON public.game_mechanics FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Game Admin Data: admin only
DROP POLICY IF EXISTS "Admins can view game admin data" ON public.game_admin_data;
CREATE POLICY "Admins can view game admin data" ON public.game_admin_data FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert game admin data" ON public.game_admin_data;
CREATE POLICY "Admins can insert game admin data" ON public.game_admin_data FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update game admin data" ON public.game_admin_data;
CREATE POLICY "Admins can update game admin data" ON public.game_admin_data FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete game admin data" ON public.game_admin_data;
CREATE POLICY "Admins can delete game admin data" ON public.game_admin_data FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Game Messages: admin read/update/delete, service role insert
DROP POLICY IF EXISTS "Admins can view messages" ON public.game_messages;
CREATE POLICY "Admins can view messages" ON public.game_messages FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update messages" ON public.game_messages;
CREATE POLICY "Admins can update messages" ON public.game_messages FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete messages" ON public.game_messages;
CREATE POLICY "Admins can delete messages" ON public.game_messages FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service role can insert messages" ON public.game_messages;
CREATE POLICY "Service role can insert messages" ON public.game_messages FOR INSERT WITH CHECK (true);

-- Game Sessions: public read, admin write
DROP POLICY IF EXISTS "Sessions viewable by everyone" ON public.game_sessions;
CREATE POLICY "Sessions viewable by everyone" ON public.game_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert sessions" ON public.game_sessions;
CREATE POLICY "Admins can insert sessions" ON public.game_sessions FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update sessions" ON public.game_sessions;
CREATE POLICY "Admins can update sessions" ON public.game_sessions FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete sessions" ON public.game_sessions;
CREATE POLICY "Admins can delete sessions" ON public.game_sessions FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Game Session Players: public read, admin write
DROP POLICY IF EXISTS "Session players viewable by everyone" ON public.game_session_players;
CREATE POLICY "Session players viewable by everyone" ON public.game_session_players FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert session players" ON public.game_session_players;
CREATE POLICY "Admins can insert session players" ON public.game_session_players FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update session players" ON public.game_session_players;
CREATE POLICY "Admins can update session players" ON public.game_session_players FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete session players" ON public.game_session_players;
CREATE POLICY "Admins can delete session players" ON public.game_session_players FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Game Wishlist: admin only (public uses edge function)
DROP POLICY IF EXISTS "Admins can manage wishlist" ON public.game_wishlist;
CREATE POLICY "Admins can manage wishlist" ON public.game_wishlist FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Site Settings: admin only (public uses view)
DROP POLICY IF EXISTS "Admins can view all site settings" ON public.site_settings;
CREATE POLICY "Admins can view all site settings" ON public.site_settings FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert site settings" ON public.site_settings;
CREATE POLICY "Admins can insert site settings" ON public.site_settings FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update site settings" ON public.site_settings;
CREATE POLICY "Admins can update site settings" ON public.site_settings FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete site settings" ON public.site_settings;
CREATE POLICY "Admins can delete site settings" ON public.site_settings FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- User Roles: users see own, admins manage all
DROP POLICY IF EXISTS "Users can only view their own roles" ON public.user_roles;
CREATE POLICY "Users can only view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ==========================================
-- GRANT PERMISSIONS
-- ==========================================

-- Grant usage on public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant access to tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;

-- Grant access to sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Grant execute on functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Specific grants for service_role (bypass RLS for edge functions)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
