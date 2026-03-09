CREATE OR REPLACE FUNCTION public.delete_game_safely(_game_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _library_id uuid;
  _owner_id uuid;
BEGIN
  -- Verify the game exists and get its library
  SELECT g.library_id INTO _library_id
  FROM public.games g
  WHERE g.id = _game_id;

  IF _library_id IS NULL THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  -- Verify the caller owns the library or is admin
  SELECT l.owner_id INTO _owner_id
  FROM public.libraries l
  WHERE l.id = _library_id;

  IF _owner_id != auth.uid() 
     AND NOT public.is_library_co_owner(auth.uid(), _library_id)
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized to delete this game';
  END IF;

  -- Delete the game (CASCADE will handle child rows since we're SECURITY DEFINER)
  DELETE FROM public.games WHERE id = _game_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_game_safely(uuid) TO authenticated;