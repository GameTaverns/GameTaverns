-- Update game_ratings_summary to exclude old bgg-community source and include bgg-user ratings
DROP VIEW IF EXISTS public.game_ratings_summary;
CREATE VIEW public.game_ratings_summary WITH (security_invoker=on) AS
  SELECT game_id,
    round(avg(rating), 1) AS average_rating,
    (count(*))::integer AS rating_count,
    round(avg(rating) FILTER (WHERE source = 'visitor'), 1) AS visitor_average,
    (count(*) FILTER (WHERE source = 'visitor'))::integer AS visitor_count,
    round(avg(rating) FILTER (WHERE source = 'bgg-user'), 1) AS bgg_user_average,
    (count(*) FILTER (WHERE source = 'bgg-user'))::integer AS bgg_user_count
  FROM game_ratings
  WHERE source IN ('visitor', 'bgg-user')
  GROUP BY game_id;
GRANT SELECT ON public.game_ratings_summary TO anon, authenticated;

-- Delete old bgg-community ratings from library game_ratings (already done via insert tool, but ensure clean state)
DELETE FROM public.game_ratings WHERE guest_identifier = 'bgg-community';
