-- Performance indexes for common query patterns

-- Games: library browse with sorting (most common query)
CREATE INDEX IF NOT EXISTS idx_games_library_title ON public.games (library_id, title);
CREATE INDEX IF NOT EXISTS idx_games_library_favorite ON public.games (library_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_games_library_for_sale ON public.games (library_id, is_for_sale) WHERE is_for_sale = true;
CREATE INDEX IF NOT EXISTS idx_games_library_expansion ON public.games (library_id, is_expansion);

-- Game sessions: play stats queries
CREATE INDEX IF NOT EXISTS idx_game_sessions_game_played ON public.game_sessions (game_id, played_at DESC);

-- Catalog: browsing with filters  
CREATE INDEX IF NOT EXISTS idx_game_catalog_title_lower ON public.game_catalog (lower(title));

-- Notification log: user inbox query
CREATE INDEX IF NOT EXISTS idx_notification_log_user_sent ON public.notification_log (user_id, sent_at DESC);

-- Forum: thread listing performance
CREATE INDEX IF NOT EXISTS idx_forum_threads_category_pinned ON public.forum_threads (category_id, is_pinned DESC, last_reply_at DESC NULLS LAST);