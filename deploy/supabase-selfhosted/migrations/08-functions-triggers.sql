-- =============================================================================
-- GameTaverns Self-Hosted: Database Functions & Triggers
-- =============================================================================

-- ===========================================
-- Utility Functions
-- ===========================================

-- Slugify function
CREATE OR REPLACE FUNCTION public.slugify(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = 'public, extensions'
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
SET search_path = 'public'
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
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- ===========================================
-- Role Check Functions
-- ===========================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

CREATE OR REPLACE FUNCTION public.is_library_member(_user_id uuid, _library_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_members
    WHERE user_id = _user_id AND library_id = _library_id
  ) OR EXISTS (
    SELECT 1 FROM public.libraries
    WHERE id = _library_id AND owner_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_library_moderator(_user_id uuid, _library_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_members
    WHERE user_id = _user_id 
    AND library_id = _library_id 
    AND role = 'moderator'
  ) OR EXISTS (
    SELECT 1 FROM public.libraries
    WHERE id = _library_id AND owner_id = _user_id
  ) OR public.has_role(_user_id, 'admin')
$$;

-- Check slug availability
CREATE OR REPLACE FUNCTION public.is_slug_available(check_slug text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT NOT EXISTS (
        SELECT 1 FROM public.libraries WHERE slug = lower(check_slug)
    );
$$;

-- ===========================================
-- Auto-Triggers
-- ===========================================

-- Auto-set game slug
CREATE OR REPLACE FUNCTION public.set_game_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.title);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS games_set_slug_trigger ON public.games;
CREATE TRIGGER games_set_slug_trigger
    BEFORE INSERT OR UPDATE ON public.games
    FOR EACH ROW
    EXECUTE FUNCTION public.set_game_slug();

-- Auto-create library settings
CREATE OR REPLACE FUNCTION public.create_library_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    INSERT INTO public.library_settings (library_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_library_settings_trigger ON public.libraries;
CREATE TRIGGER create_library_settings_trigger
    AFTER INSERT ON public.libraries
    FOR EACH ROW
    EXECUTE FUNCTION public.create_library_settings();

-- Auto-create user profile (for Supabase auth)
CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
    RETURN NEW;
END;
$$;

-- Note: This trigger is attached to auth.users by Supabase
-- It will be created separately if needed

-- ===========================================
-- Updated_at Triggers
-- ===========================================

DROP TRIGGER IF EXISTS update_libraries_updated_at ON public.libraries;
CREATE TRIGGER update_libraries_updated_at
    BEFORE UPDATE ON public.libraries
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_library_settings_updated_at ON public.library_settings;
CREATE TRIGGER update_library_settings_updated_at
    BEFORE UPDATE ON public.library_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_games_updated_at ON public.games;
CREATE TRIGGER update_games_updated_at
    BEFORE UPDATE ON public.games
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- Cleanup Functions
-- ===========================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.password_reset_tokens
  WHERE expires_at < now() - interval '24 hours';
  
  DELETE FROM public.email_confirmation_tokens
  WHERE expires_at < now() - interval '24 hours';
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_messages(retention_days integer DEFAULT 365)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.game_messages
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
