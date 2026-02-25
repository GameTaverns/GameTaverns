CREATE OR REPLACE FUNCTION public.get_catalog_filter_options()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'designers', COALESCE((
      SELECT jsonb_agg(DISTINCT d.name ORDER BY d.name)
      FROM catalog_designers cd
      JOIN designers d ON d.id = cd.designer_id
    ), '[]'::jsonb),
    'artists', COALESCE((
      SELECT jsonb_agg(DISTINCT a.name ORDER BY a.name)
      FROM catalog_artists ca
      JOIN artists a ON a.id = ca.artist_id
    ), '[]'::jsonb),
    'mechanics', COALESCE((
      SELECT jsonb_agg(DISTINCT m.name ORDER BY m.name)
      FROM catalog_mechanics cm
      JOIN mechanics m ON m.id = cm.mechanic_id
    ), '[]'::jsonb),
    'publishers', COALESCE((
      SELECT jsonb_agg(DISTINCT p.name ORDER BY p.name)
      FROM catalog_publishers cp
      JOIN publishers p ON p.id = cp.publisher_id
    ), '[]'::jsonb)
  );
$$;