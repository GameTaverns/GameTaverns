-- =============================================================================
-- GameTaverns Self-Hosted: Database Functions & Triggers
-- Version: 2.2.0 - 5-Tier Role Hierarchy
-- Complete 1:1 parity with Lovable Cloud schema
-- =============================================================================

-- ===========================================
-- Utility Functions
-- ===========================================

-- Generate slug function (pure SQL, no extension dependency)
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

-- Slugify function with unaccent (uses extensions schema)
CREATE OR REPLACE FUNCTION public.slugify(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = 'public'
AS $$
DECLARE
  result TEXT;
BEGIN
  -- Try to use unaccent if available, otherwise fall back to generate_slug
  BEGIN
    SELECT trim(both '-' from regexp_replace(
      regexp_replace(lower(extensions.unaccent(coalesce(input, ''))), '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )) INTO result;
    RETURN result;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback if unaccent not available
    RETURN public.generate_slug(input);
  END;
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

-- Set timezone function
CREATE OR REPLACE FUNCTION public.set_timezone()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SET timezone TO 'America/New_York';
$$;

-- ===========================================
-- Role Hierarchy Functions (5-Tier System)
-- T1: admin, T2: staff, T3: owner, T4: moderator, T5: user
-- ===========================================

-- Get the tier number for a role (lower = more privileged)
CREATE OR REPLACE FUNCTION public.get_role_tier(_role app_role)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = 'public'
AS $$
  SELECT CASE _role
    WHEN 'admin' THEN 1
    WHEN 'staff' THEN 2
    WHEN 'owner' THEN 3
    WHEN 'moderator' THEN 4
    ELSE 5
  END;
$$;

-- Check if user has a specific role (exact match)
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

-- Check if user has at least a certain role level (hierarchical check)
-- e.g., has_role_level(uid, 'staff') returns true if user is admin or staff
CREATE OR REPLACE FUNCTION public.has_role_level(_user_id uuid, _min_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND public.get_role_tier(role) <= public.get_role_tier(_min_role)
  )
$$;

-- Check if user is a member of a library (includes owner)
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

-- Check if user is a moderator of a library (or owner, or platform staff/admin)
CREATE OR REPLACE FUNCTION public.is_library_moderator(_user_id uuid, _library_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    -- User is a moderator in the specific library (library_member_role)
    SELECT 1 FROM public.library_members
    WHERE user_id = _user_id 
    AND library_id = _library_id 
    AND role = 'moderator'
  ) OR EXISTS (
    -- User is the library owner
    SELECT 1 FROM public.libraries
    WHERE id = _library_id AND owner_id = _user_id
  ) OR public.has_role_level(_user_id, 'staff') -- admin or staff at platform level
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

-- Auto-set game slug on insert/update
CREATE OR REPLACE FUNCTION public.set_game_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.generate_slug(NEW.title);
  END IF;
  RETURN NEW;
END;
$$;

-- Alias function for compatibility
CREATE OR REPLACE FUNCTION public.games_set_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    NEW.slug := public.slugify(NEW.title);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger only if games table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'games') THEN
        DROP TRIGGER IF EXISTS games_set_slug_trigger ON public.games;
        CREATE TRIGGER games_set_slug_trigger
            BEFORE INSERT OR UPDATE ON public.games
            FOR EACH ROW
            EXECUTE FUNCTION public.set_game_slug();
        RAISE NOTICE 'Created games_set_slug_trigger';
    ELSE
        RAISE NOTICE 'Skipping games_set_slug_trigger - games table does not exist yet';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creating games_set_slug_trigger: %', SQLERRM;
END $$;

-- Auto-create library settings when library is created
CREATE OR REPLACE FUNCTION public.create_library_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    INSERT INTO public.library_settings (library_id)
    VALUES (NEW.id)
    ON CONFLICT (library_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_library_settings_trigger ON public.libraries;
CREATE TRIGGER create_library_settings_trigger
    AFTER INSERT ON public.libraries
    FOR EACH ROW
    EXECUTE FUNCTION public.create_library_settings();

-- Auto-create user profile when user signs up (for Supabase auth)
CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- NOTE: The trigger on auth.users is created in a separate migration
-- since it requires superuser access to the auth schema

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

DROP TRIGGER IF EXISTS update_game_admin_data_updated_at ON public.game_admin_data;
CREATE TRIGGER update_game_admin_data_updated_at
    BEFORE UPDATE ON public.game_admin_data
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_game_ratings_updated_at ON public.game_ratings;
CREATE TRIGGER update_game_ratings_updated_at
    BEFORE UPDATE ON public.game_ratings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_game_sessions_updated_at ON public.game_sessions;
CREATE TRIGGER update_game_sessions_updated_at
    BEFORE UPDATE ON public.game_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_game_loans_updated_at ON public.game_loans;
CREATE TRIGGER update_game_loans_updated_at
    BEFORE UPDATE ON public.game_loans
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_library_events_updated_at ON public.library_events;
CREATE TRIGGER update_library_events_updated_at
    BEFORE UPDATE ON public.library_events
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_game_polls_updated_at ON public.game_polls;
CREATE TRIGGER update_game_polls_updated_at
    BEFORE UPDATE ON public.game_polls
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_game_night_rsvps_updated_at ON public.game_night_rsvps;
CREATE TRIGGER update_game_night_rsvps_updated_at
    BEFORE UPDATE ON public.game_night_rsvps
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE ON public.notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_import_jobs_updated_at ON public.import_jobs;
CREATE TRIGGER update_import_jobs_updated_at
    BEFORE UPDATE ON public.import_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_site_settings_updated_at ON public.site_settings;
CREATE TRIGGER update_site_settings_updated_at
    BEFORE UPDATE ON public.site_settings
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
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_email_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
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

-- ===========================================
-- Rate Limiting Functions
-- ===========================================

-- Check follow rate limit (10 follows per minute per user)
CREATE OR REPLACE FUNCTION public.check_follow_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  recent_follow_count INTEGER;
BEGIN
  -- Count follows by this user in the last minute
  SELECT COUNT(*) INTO recent_follow_count
  FROM public.library_followers
  WHERE follower_user_id = NEW.follower_user_id
  AND followed_at > NOW() - INTERVAL '1 minute';
  
  -- Allow maximum 10 follows per minute
  IF recent_follow_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before following more libraries.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create rate limit trigger on library_followers
DROP TRIGGER IF EXISTS check_follow_rate_limit_trigger ON public.library_followers;
CREATE TRIGGER check_follow_rate_limit_trigger
    BEFORE INSERT ON public.library_followers
    FOR EACH ROW
    EXECUTE FUNCTION public.check_follow_rate_limit();
