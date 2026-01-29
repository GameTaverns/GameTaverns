-- Fix the new views to use security_invoker
DROP VIEW IF EXISTS public.library_directory;
DROP VIEW IF EXISTS public.borrower_reputation;

-- Public library directory view with security invoker
CREATE OR REPLACE VIEW public.library_directory 
WITH (security_invoker = true)
AS
SELECT 
    l.id,
    l.name,
    l.slug,
    l.description,
    l.created_at,
    ls.logo_url,
    ls.is_discoverable,
    ls.allow_lending,
    (SELECT COUNT(*) FROM public.games g WHERE g.library_id = l.id AND NOT g.is_expansion) as game_count,
    (SELECT COUNT(*) FROM public.library_followers lf WHERE lf.library_id = l.id) as follower_count
FROM public.libraries l
LEFT JOIN public.library_settings ls ON ls.library_id = l.id
WHERE l.is_active = true 
AND (ls.is_discoverable = true OR ls.is_discoverable IS NULL);

-- Borrower reputation view with security invoker
CREATE OR REPLACE VIEW public.borrower_reputation
WITH (security_invoker = true)
AS
SELECT 
    br.rated_user_id as user_id,
    COUNT(*) as total_ratings,
    ROUND(AVG(br.rating), 1) as average_rating,
    COUNT(*) FILTER (WHERE br.rating >= 4) as positive_ratings
FROM public.borrower_ratings br
GROUP BY br.rated_user_id;