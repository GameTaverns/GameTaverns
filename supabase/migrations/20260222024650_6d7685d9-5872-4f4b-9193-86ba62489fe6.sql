
-- When a user is made co_owner in library_members, ensure they have the 'owner' app_role in user_roles
CREATE OR REPLACE FUNCTION public.sync_co_owner_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- On INSERT or UPDATE to co_owner role, grant 'owner' app_role
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.role::text = 'co_owner' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- On UPDATE away from co_owner, remove 'owner' role ONLY if user doesn't own any library
  -- and isn't co_owner of any other library
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

-- On DELETE of co_owner membership, remove 'owner' role if no longer applicable
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

CREATE TRIGGER trg_sync_co_owner_role
AFTER INSERT OR UPDATE OF role ON public.library_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_co_owner_role();

CREATE TRIGGER trg_sync_co_owner_role_on_delete
AFTER DELETE ON public.library_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_co_owner_role_on_delete();
