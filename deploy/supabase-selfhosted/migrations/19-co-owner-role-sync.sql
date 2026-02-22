-- =============================================================================
-- GameTaverns Self-Hosted: Co-Owner Role Sync & RLS UPDATE Policy
-- Version: 2.7.6
-- =============================================================================

SET LOCAL lock_timeout = '5s';

-- ===========================================
-- RLS: Allow library owners to UPDATE member roles
-- ===========================================
DROP POLICY IF EXISTS "Library owners can update member roles" ON public.library_members;
CREATE POLICY "Library owners can update member roles" ON public.library_members
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
        OR public.is_library_co_owner(auth.uid(), library_id)
        OR public.has_role(auth.uid(), 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
        OR public.is_library_co_owner(auth.uid(), library_id)
        OR public.has_role(auth.uid(), 'admin')
    );

-- ===========================================
-- Trigger: Sync co_owner role to user_roles
-- ===========================================
CREATE OR REPLACE FUNCTION public.sync_co_owner_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.role::text = 'co_owner' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.role::text = 'co_owner' AND NEW.role::text != 'co_owner' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.libraries WHERE owner_id = NEW.user_id
    ) AND NOT EXISTS (
      SELECT 1 FROM public.library_members
      WHERE user_id = NEW.user_id AND role::text = 'co_owner' AND id != NEW.id
    ) THEN
      DELETE FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'owner';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_co_owner_role_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.role::text = 'co_owner' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.libraries WHERE owner_id = OLD.user_id
    ) AND NOT EXISTS (
      SELECT 1 FROM public.library_members
      WHERE user_id = OLD.user_id AND role::text = 'co_owner' AND id != OLD.id
    ) THEN
      DELETE FROM public.user_roles WHERE user_id = OLD.user_id AND role = 'owner';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_co_owner_role ON public.library_members;
CREATE TRIGGER trg_sync_co_owner_role
AFTER INSERT OR UPDATE OF role ON public.library_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_co_owner_role();

DROP TRIGGER IF EXISTS trg_sync_co_owner_role_on_delete ON public.library_members;
CREATE TRIGGER trg_sync_co_owner_role_on_delete
AFTER DELETE ON public.library_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_co_owner_role_on_delete();

-- ===========================================
-- Done
-- ===========================================
