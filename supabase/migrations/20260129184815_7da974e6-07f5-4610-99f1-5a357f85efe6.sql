-- ============================================
-- GAME LENDING SYSTEM
-- ============================================

-- Enum for loan status
CREATE TYPE public.loan_status AS ENUM ('requested', 'approved', 'active', 'returned', 'declined', 'cancelled');

-- Game loans table
CREATE TABLE public.game_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
    borrower_user_id UUID NOT NULL,  -- The user borrowing the game
    lender_user_id UUID NOT NULL,    -- The library owner
    status loan_status NOT NULL DEFAULT 'requested',
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    approved_at TIMESTAMP WITH TIME ZONE,
    borrowed_at TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    returned_at TIMESTAMP WITH TIME ZONE,
    borrower_notes TEXT,
    lender_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Borrower ratings (library owners rate borrowers)
CREATE TABLE public.borrower_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES public.game_loans(id) ON DELETE CASCADE,
    rated_user_id UUID NOT NULL,      -- The borrower being rated
    rated_by_user_id UUID NOT NULL,   -- The lender rating
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(loan_id)  -- One rating per loan
);

-- Enable RLS
ALTER TABLE public.game_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrower_ratings ENABLE ROW LEVEL SECURITY;

-- Game loans policies
CREATE POLICY "Users can view their own loan requests"
ON public.game_loans FOR SELECT
USING (borrower_user_id = auth.uid() OR lender_user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can request loans"
ON public.game_loans FOR INSERT
WITH CHECK (borrower_user_id = auth.uid());

CREATE POLICY "Lenders and borrowers can update loans"
ON public.game_loans FOR UPDATE
USING (borrower_user_id = auth.uid() OR lender_user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Lenders can delete loan records"
ON public.game_loans FOR DELETE
USING (lender_user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Borrower ratings policies
CREATE POLICY "Anyone can view borrower ratings"
ON public.borrower_ratings FOR SELECT
USING (true);

CREATE POLICY "Lenders can rate borrowers after return"
ON public.borrower_ratings FOR INSERT
WITH CHECK (
    rated_by_user_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.game_loans
        WHERE id = loan_id AND lender_user_id = auth.uid() AND status = 'returned'
    )
);

-- ============================================
-- ACHIEVEMENTS & BADGES SYSTEM
-- ============================================

-- Achievement types enum
CREATE TYPE public.achievement_category AS ENUM (
    'collector',      -- Game collection milestones
    'player',         -- Play session milestones
    'social',         -- Community engagement
    'explorer',       -- Discovery milestones
    'contributor',    -- Content creation
    'lender'          -- Lending milestones
);

-- Master achievement definitions (platform-wide)
CREATE TABLE public.achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category achievement_category NOT NULL,
    icon TEXT,                          -- Lucide icon name or emoji
    points INTEGER NOT NULL DEFAULT 10,
    tier INTEGER NOT NULL DEFAULT 1,    -- Bronze=1, Silver=2, Gold=3, Platinum=4
    requirement_type TEXT NOT NULL,     -- e.g., 'games_owned', 'sessions_logged', 'loans_completed'
    requirement_value INTEGER NOT NULL, -- e.g., 10, 50, 100
    is_secret BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User achievements (earned badges)
CREATE TABLE public.user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    progress INTEGER NOT NULL DEFAULT 0,    -- Current progress toward achievement
    notified BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(user_id, achievement_id)
);

-- Enable RLS
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Achievements policies
CREATE POLICY "Achievements are viewable by everyone"
ON public.achievements FOR SELECT
USING (NOT is_secret OR EXISTS (
    SELECT 1 FROM public.user_achievements WHERE achievement_id = achievements.id AND user_id = auth.uid()
));

CREATE POLICY "Admins can manage achievements"
ON public.achievements FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- User achievements policies
CREATE POLICY "Users can view their own achievements"
ON public.user_achievements FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view others public achievements"
ON public.user_achievements FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.achievements a WHERE a.id = achievement_id AND NOT a.is_secret
));

CREATE POLICY "Service role can manage user achievements"
ON public.user_achievements FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- NOTIFICATION PREFERENCES SYSTEM
-- ============================================

-- Notification preferences per user
CREATE TABLE public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    -- Email notifications
    email_loan_requests BOOLEAN NOT NULL DEFAULT true,
    email_loan_updates BOOLEAN NOT NULL DEFAULT true,
    email_event_reminders BOOLEAN NOT NULL DEFAULT true,
    email_wishlist_alerts BOOLEAN NOT NULL DEFAULT true,
    email_achievement_earned BOOLEAN NOT NULL DEFAULT true,
    -- Push notifications (mobile app)
    push_loan_requests BOOLEAN NOT NULL DEFAULT true,
    push_loan_updates BOOLEAN NOT NULL DEFAULT true,
    push_event_reminders BOOLEAN NOT NULL DEFAULT true,
    push_wishlist_alerts BOOLEAN NOT NULL DEFAULT false,
    push_achievement_earned BOOLEAN NOT NULL DEFAULT true,
    -- Discord notifications (via existing webhook system)
    discord_loan_requests BOOLEAN NOT NULL DEFAULT true,
    discord_loan_updates BOOLEAN NOT NULL DEFAULT true,
    discord_event_reminders BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Notification log (for tracking sent notifications)
CREATE TABLE public.notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    notification_type TEXT NOT NULL,
    channel TEXT NOT NULL,  -- 'email', 'push', 'discord'
    title TEXT NOT NULL,
    body TEXT,
    metadata JSONB,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- Notification preferences policies
CREATE POLICY "Users can manage their notification preferences"
ON public.notification_preferences FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Notification log policies
CREATE POLICY "Users can view their notification history"
ON public.notification_log FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert notifications"
ON public.notification_log FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can mark their notifications as read"
ON public.notification_log FOR UPDATE
USING (user_id = auth.uid());

-- ============================================
-- PUBLIC LIBRARY DIRECTORY
-- ============================================

-- Library visibility settings (extension of library_settings)
ALTER TABLE public.library_settings 
ADD COLUMN IF NOT EXISTS is_discoverable BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS allow_lending BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS lending_terms TEXT;

-- Library followers (for the directory/social features)
CREATE TABLE public.library_followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
    follower_user_id UUID NOT NULL,
    followed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(library_id, follower_user_id)
);

-- Enable RLS
ALTER TABLE public.library_followers ENABLE ROW LEVEL SECURITY;

-- Library followers policies
CREATE POLICY "Anyone can view library followers count"
ON public.library_followers FOR SELECT
USING (true);

CREATE POLICY "Users can follow libraries"
ON public.library_followers FOR INSERT
WITH CHECK (follower_user_id = auth.uid());

CREATE POLICY "Users can unfollow libraries"
ON public.library_followers FOR DELETE
USING (follower_user_id = auth.uid());

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_game_loans_borrower ON public.game_loans(borrower_user_id);
CREATE INDEX idx_game_loans_lender ON public.game_loans(lender_user_id);
CREATE INDEX idx_game_loans_status ON public.game_loans(status);
CREATE INDEX idx_game_loans_game ON public.game_loans(game_id);
CREATE INDEX idx_game_loans_due_date ON public.game_loans(due_date) WHERE status = 'active';

CREATE INDEX idx_user_achievements_user ON public.user_achievements(user_id);
CREATE INDEX idx_user_achievements_achievement ON public.user_achievements(achievement_id);

CREATE INDEX idx_notification_log_user ON public.notification_log(user_id);
CREATE INDEX idx_notification_log_unread ON public.notification_log(user_id) WHERE read_at IS NULL;

CREATE INDEX idx_library_followers_library ON public.library_followers(library_id);
CREATE INDEX idx_library_followers_user ON public.library_followers(follower_user_id);

CREATE INDEX idx_borrower_ratings_user ON public.borrower_ratings(rated_user_id);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_game_loans_updated_at
BEFORE UPDATE ON public.game_loans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- SEED DEFAULT ACHIEVEMENTS
-- ============================================

INSERT INTO public.achievements (slug, name, description, category, icon, points, tier, requirement_type, requirement_value) VALUES
-- Collector achievements
('first_game', 'First Acquisition', 'Add your first game to your library', 'collector', '🎲', 10, 1, 'games_owned', 1),
('collector_10', 'Growing Collection', 'Own 10 games in your library', 'collector', '📦', 25, 1, 'games_owned', 10),
('collector_50', 'Serious Collector', 'Own 50 games in your library', 'collector', '🏆', 50, 2, 'games_owned', 50),
('collector_100', 'Game Hoarder', 'Own 100 games in your library', 'collector', '👑', 100, 3, 'games_owned', 100),
('collector_500', 'Legendary Vault', 'Own 500 games in your library', 'collector', '🏰', 500, 4, 'games_owned', 500),

-- Player achievements
('first_play', 'Game Night Begins', 'Log your first play session', 'player', '🎯', 10, 1, 'sessions_logged', 1),
('player_10', 'Regular Player', 'Log 10 play sessions', 'player', '🎮', 25, 1, 'sessions_logged', 10),
('player_50', 'Dedicated Gamer', 'Log 50 play sessions', 'player', '⭐', 50, 2, 'sessions_logged', 50),
('player_100', 'Veteran Player', 'Log 100 play sessions', 'player', '🌟', 100, 3, 'sessions_logged', 100),

-- Lender achievements
('first_loan', 'Generous Host', 'Lend a game for the first time', 'lender', '🤝', 15, 1, 'loans_completed', 1),
('lender_10', 'Community Pillar', 'Complete 10 game loans', 'lender', '💫', 50, 2, 'loans_completed', 10),
('lender_50', 'Library Legend', 'Complete 50 game loans', 'lender', '🌍', 150, 3, 'loans_completed', 50),

-- Social achievements
('first_follower', 'Making Friends', 'Gain your first library follower', 'social', '👋', 10, 1, 'followers_gained', 1),
('popular_10', 'Rising Star', 'Gain 10 library followers', 'social', '⭐', 25, 2, 'followers_gained', 10),
('popular_50', 'Community Favorite', 'Gain 50 library followers', 'social', '🌟', 75, 3, 'followers_gained', 50),

-- Explorer achievements
('first_wishlist', 'Window Shopping', 'Add a game to your wishlist', 'explorer', '💭', 5, 1, 'wishlist_votes', 1),
('first_rating', 'Critic', 'Rate your first game', 'explorer', '⭐', 5, 1, 'ratings_given', 1),
('explorer_variety', 'Genre Explorer', 'Play games from 5 different types', 'explorer', '🗺️', 30, 2, 'unique_game_types', 5);

-- ============================================
-- PUBLIC VIEWS
-- ============================================

-- Public library directory view (excludes private libraries)
CREATE OR REPLACE VIEW public.library_directory AS
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

-- Borrower reputation view
CREATE OR REPLACE VIEW public.borrower_reputation AS
SELECT 
    br.rated_user_id as user_id,
    COUNT(*) as total_ratings,
    ROUND(AVG(br.rating), 1) as average_rating,
    COUNT(*) FILTER (WHERE br.rating >= 4) as positive_ratings
FROM public.borrower_ratings br
GROUP BY br.rated_user_id;