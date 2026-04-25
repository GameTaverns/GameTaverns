-- =============================================================================
-- PHASE 1: SEMANTIC SEARCH — MRR EVALUATION
-- Compute Mean Reciprocal Rank from logged searches, comparing semantic vs keyword.
-- Run any time after users have been searching for a while.
-- =============================================================================

-- Per-mode MRR (only counts searches where the user clicked something)
SELECT
  search_mode,
  COUNT(*) FILTER (WHERE clicked_rank IS NOT NULL)            AS clicked_searches,
  COUNT(*)                                                    AS total_searches,
  ROUND(
    AVG(1.0 / clicked_rank) FILTER (WHERE clicked_rank IS NOT NULL)::numeric,
    4
  ) AS mrr,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE clicked_rank IS NOT NULL) / NULLIF(COUNT(*), 0),
    1
  ) AS click_through_rate_pct
FROM public.search_eval_log
WHERE created_at > now() - interval '30 days'
GROUP BY search_mode
ORDER BY search_mode;

-- Top "winning" semantic queries — high-rank clicks that keyword search likely couldn't have served
-- (queries with 4+ words tend to be natural language and semantic-favorable)
SELECT
  query,
  clicked_rank,
  COUNT(*) AS occurrences
FROM public.search_eval_log
WHERE search_mode = 'semantic'
  AND clicked_rank IS NOT NULL
  AND clicked_rank <= 5
  AND array_length(string_to_array(query, ' '), 1) >= 4
GROUP BY query, clicked_rank
ORDER BY occurrences DESC, clicked_rank
LIMIT 20;

-- Coverage: % of catalog that has been embedded
SELECT
  (SELECT COUNT(*) FROM public.game_catalog
     WHERE is_expansion = false AND description IS NOT NULL) AS eligible_games,
  (SELECT COUNT(*) FROM public.catalog_embeddings)            AS embedded_games,
  ROUND(100.0 * (SELECT COUNT(*) FROM public.catalog_embeddings)
        / NULLIF((SELECT COUNT(*) FROM public.game_catalog
                    WHERE is_expansion = false AND description IS NOT NULL), 0), 1) AS pct_embedded;
