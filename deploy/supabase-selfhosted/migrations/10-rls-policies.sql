-- =============================================================================
-- GameTaverns Self-Hosted: Row Level Security Policies
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_admin_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_mechanics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_session_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrower_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_night_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_suspensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_confirmation_tokens ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- User Profiles Policies
-- ===========================================
CREATE POLICY "Users can view all profiles" ON public.user_profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert profiles" ON public.user_profiles
    FOR INSERT WITH CHECK (true);

-- ===========================================
-- User Roles Policies
-- ===========================================
CREATE POLICY "Admins can manage roles" ON public.user_roles
    FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own roles" ON public.user_roles
    FOR SELECT USING (user_id = auth.uid());

-- ===========================================
-- Libraries Policies
-- ===========================================
CREATE POLICY "Anyone can view active libraries" ON public.libraries
    FOR SELECT USING (is_active = true OR auth.uid() = owner_id);

CREATE POLICY "Owners can manage their libraries" ON public.libraries
    FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Admins can manage all libraries" ON public.libraries
    FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can create libraries" ON public.libraries
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- ===========================================
-- Library Settings Policies
-- ===========================================
CREATE POLICY "Public can view settings of active libraries" ON public.library_settings
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND is_active = true)
    );

CREATE POLICY "Owners can manage their library settings" ON public.library_settings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND owner_id = auth.uid())
    );

-- ===========================================
-- Games Policies
-- ===========================================
CREATE POLICY "Public can view games in active libraries" ON public.games
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND is_active = true)
    );

CREATE POLICY "Library owners can manage games" ON public.games
    FOR ALL USING (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND owner_id = auth.uid())
        OR has_role(auth.uid(), 'admin')
    );

-- ===========================================
-- Game Admin Data Policies
-- ===========================================
CREATE POLICY "Library owners can view their game admin data" ON public.game_admin_data
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM games g
            JOIN libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Library owners can manage game admin data" ON public.game_admin_data
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM games g
            JOIN libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR has_role(auth.uid(), 'admin')
    );

-- ===========================================
-- Game Mechanics Policies
-- ===========================================
CREATE POLICY "Anyone can view game mechanics" ON public.game_mechanics
    FOR SELECT USING (true);

CREATE POLICY "Library owners can manage game mechanics" ON public.game_mechanics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM games g
            JOIN libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR has_role(auth.uid(), 'admin')
    );

-- ===========================================
-- Game Ratings Policies (service role for insert/update)
-- ===========================================
CREATE POLICY "Anyone can view rating summaries" ON public.game_ratings
    FOR SELECT USING (true);

-- ===========================================
-- Game Wishlist Policies
-- ===========================================
CREATE POLICY "Anyone can view wishlist" ON public.game_wishlist
    FOR SELECT USING (true);

-- ===========================================
-- Game Messages Policies
-- ===========================================
CREATE POLICY "Library owners can view their messages" ON public.game_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM games g
            JOIN libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        )
    );

CREATE POLICY "Library owners can manage messages" ON public.game_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM games g
            JOIN libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR has_role(auth.uid(), 'admin')
    );

-- ===========================================
-- Game Sessions Policies
-- ===========================================
CREATE POLICY "Anyone can view sessions" ON public.game_sessions
    FOR SELECT USING (true);

CREATE POLICY "Library owners can manage sessions" ON public.game_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM games g
            JOIN libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Anyone can view session players" ON public.game_session_players
    FOR SELECT USING (true);

CREATE POLICY "Library owners can manage session players" ON public.game_session_players
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM game_sessions gs
            JOIN games g ON g.id = gs.game_id
            JOIN libraries l ON l.id = g.library_id
            WHERE gs.id = session_id AND l.owner_id = auth.uid()
        ) OR has_role(auth.uid(), 'admin')
    );

-- ===========================================
-- Game Loans Policies
-- ===========================================
CREATE POLICY "Users can view their own loans" ON public.game_loans
    FOR SELECT USING (
        borrower_user_id = auth.uid() OR lender_user_id = auth.uid()
        OR has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Members can request loans" ON public.game_loans
    FOR INSERT WITH CHECK (
        borrower_user_id = auth.uid() AND is_library_member(auth.uid(), library_id)
    );

CREATE POLICY "Lenders and borrowers can update loans" ON public.game_loans
    FOR UPDATE USING (
        borrower_user_id = auth.uid() OR lender_user_id = auth.uid()
        OR has_role(auth.uid(), 'admin')
    );

-- ===========================================
-- Events & Polls Policies
-- ===========================================
CREATE POLICY "Public can view events in active libraries" ON public.library_events
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND is_active = true)
    );

CREATE POLICY "Library owners can manage events" ON public.library_events
    FOR ALL USING (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND owner_id = auth.uid())
        OR has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Anyone can view open polls" ON public.game_polls
    FOR SELECT USING (status IN ('open', 'closed'));

CREATE POLICY "Library owners can manage polls" ON public.game_polls
    FOR ALL USING (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND owner_id = auth.uid())
        OR has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Anyone can view poll options" ON public.poll_options
    FOR SELECT USING (true);

CREATE POLICY "Anyone can view poll votes" ON public.poll_votes
    FOR SELECT USING (true);

-- ===========================================
-- Achievements Policies
-- ===========================================
CREATE POLICY "Anyone can view achievements" ON public.achievements
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage achievements" ON public.achievements
    FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their achievements" ON public.user_achievements
    FOR SELECT USING (user_id = auth.uid() OR true);

-- ===========================================
-- Notifications Policies
-- ===========================================
CREATE POLICY "Users can manage their preferences" ON public.notification_preferences
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view their notifications" ON public.notification_log
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can mark notifications read" ON public.notification_log
    FOR UPDATE USING (user_id = auth.uid());

-- ===========================================
-- Platform Admin Policies
-- ===========================================
CREATE POLICY "Anyone can submit feedback" ON public.platform_feedback
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view feedback" ON public.platform_feedback
    FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage feedback" ON public.platform_feedback
    FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view site settings" ON public.site_settings
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage site settings" ON public.site_settings
    FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ===========================================
-- Token Policies (deny all - use service role)
-- ===========================================
CREATE POLICY "Deny direct access" ON public.password_reset_tokens
    FOR ALL USING (false);

CREATE POLICY "Deny direct access" ON public.email_confirmation_tokens
    FOR ALL USING (false);

-- ===========================================
-- Library Members Policies
-- ===========================================
CREATE POLICY "Anyone can view members" ON public.library_members
    FOR SELECT USING (true);

CREATE POLICY "Users can join libraries" ON public.library_members
    FOR INSERT WITH CHECK (auth.uid() = user_id AND role = 'member');

CREATE POLICY "Users can leave libraries" ON public.library_members
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Owners can manage members" ON public.library_members
    FOR ALL USING (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND owner_id = auth.uid())
    );

-- ===========================================
-- Library Followers Policies
-- ===========================================
CREATE POLICY "Anyone can view followers" ON public.library_followers
    FOR SELECT USING (true);

CREATE POLICY "Users can follow" ON public.library_followers
    FOR INSERT WITH CHECK (follower_user_id = auth.uid());

CREATE POLICY "Users can unfollow" ON public.library_followers
    FOR DELETE USING (follower_user_id = auth.uid());
