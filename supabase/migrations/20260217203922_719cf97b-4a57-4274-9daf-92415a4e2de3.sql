
-- Fix views to use security_invoker to silence linter
DROP VIEW IF EXISTS public.game_ratings_summary;
CREATE VIEW public.game_ratings_summary WITH (security_invoker=on) AS
  SELECT game_id,
    round(avg(rating), 1) AS average_rating,
    (count(*))::integer AS rating_count,
    round(avg(rating) FILTER (WHERE source = 'visitor'), 1) AS visitor_average,
    (count(*) FILTER (WHERE source = 'visitor'))::integer AS visitor_count,
    round(avg(rating) FILTER (WHERE source = 'bgg'), 1) AS bgg_average,
    (count(*) FILTER (WHERE source = 'bgg'))::integer AS bgg_count
  FROM game_ratings
  GROUP BY game_id;
GRANT SELECT ON public.game_ratings_summary TO anon, authenticated;

DROP VIEW IF EXISTS public.game_ratings_library_view;
CREATE VIEW public.game_ratings_library_view WITH (security_invoker=on) AS
  SELECT id, game_id, guest_identifier, rating, source, created_at, updated_at
  FROM game_ratings;
GRANT SELECT ON public.game_ratings_library_view TO anon, authenticated;

DROP VIEW IF EXISTS public.catalog_ratings_summary;
CREATE VIEW public.catalog_ratings_summary WITH (security_invoker=on) AS
  SELECT catalog_id,
    round(avg(rating), 1) AS average_rating,
    (count(*))::integer AS rating_count,
    round(avg(rating) FILTER (WHERE source = 'visitor'), 1) AS visitor_average,
    (count(*) FILTER (WHERE source = 'visitor'))::integer AS visitor_count
  FROM catalog_ratings
  GROUP BY catalog_id;
GRANT SELECT ON public.catalog_ratings_summary TO anon, authenticated;
