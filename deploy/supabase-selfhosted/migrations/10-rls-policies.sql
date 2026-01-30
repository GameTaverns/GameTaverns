-- =============================================================================
-- GameTaverns Self-Hosted: Row Level Security Policies
-- Complete 1:1 parity with Lovable Cloud schema
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanics ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
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
CREATE POLICY "Anonymous users can view active libraries" ON public.libraries
    FOR SELECT USING (auth.uid() IS NULL AND is_active = true);

CREATE POLICY "Authenticated users can view libraries" ON public.libraries
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can manage their libraries" ON public.libraries
    FOR ALL USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Admins can manage all libraries" ON public.libraries
    FOR ALL USING (has_role(auth.uid(), 'admin'))
    WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can create libraries" ON public.libraries
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- ===========================================
-- Library Settings Policies
-- ===========================================
CREATE POLICY "Library owners can view their settings" ON public.library_settings
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND owner_id = auth.uid())
        OR has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Library owners can manage settings" ON public.library_settings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND owner_id = auth.uid())
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND owner_id = auth.uid())
    );

-- ===========================================
-- Publishers Policies
-- ===========================================
CREATE POLICY "Anyone can view publishers" ON public.publishers
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage publishers" ON public.publishers
    FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ===========================================
-- Mechanics Policies
-- ===========================================
CREATE POLICY "Anyone can view mechanics" ON public.mechanics
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage mechanics" ON public.mechanics
    FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ===========================================
-- Games Policies
-- ===========================================
CREATE POLICY "Public can view games in active libraries" ON public.games
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND is_active = true)
    );

CREATE POLICY "Library owners can view their games" ON public.games
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND owner_id = auth.uid())
        OR has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Library owners can insert games" ON public.games
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND owner_id = auth.uid())
        OR has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Library owners can update their games" ON public.games
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND owner_id = auth.uid())
        OR has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Library owners can delete their games" ON public.games
    FOR DELETE USING (
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

CREATE POLICY "Library owners can insert game admin data" ON public.game_admin_data
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM games g
            JOIN libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Library owners can update game admin data" ON public.game_admin_data
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM games g
            JOIN libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Library owners can delete game admin data" ON public.game_admin_data
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM games g
            JOIN libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Admins can view game admin data" ON public.game_admin_data
    FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert game admin data" ON public.game_admin_data
    FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update game admin data" ON public.game_admin_data
    FOR UPDATE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete game admin data" ON public.game_admin_data
    FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- ===========================================
-- Game Mechanics Policies
-- ===========================================
CREATE POLICY "Game mechanics are viewable by everyone" ON public.game_mechanics
    FOR SELECT USING (true);

CREATE POLICY "Library owners can insert game_mechanics" ON public.game_mechanics
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM games g
            JOIN libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Library owners can update game_mechanics" ON public.game_mechanics
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM games g
            JOIN libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Library owners can delete game_mechanics" ON public.game_mechanics
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM games g
            JOIN libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Admins can insert game_mechanics" ON public.game_mechanics
    FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update game_mechanics" ON public.game_mechanics
    FOR UPDATE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete game_mechanics" ON public.game_mechanics
    FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- ===========================================
-- Game Ratings Policies (service role for insert/update)
-- ===========================================
CREATE POLICY "Admins can view all ratings" ON public.game_ratings
    FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Library owners can view their game ratings via view" ON public.game_ratings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM games g
            JOIN libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        )
    );

CREATE POLICY "Admins can delete ratings" ON public.game_ratings
    FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- ===========================================
-- Game Wishlist Policies
-- ===========================================
CREATE POLICY "Anyone can view wishlist entries for summaries" ON public.game_wishlist
    FOR SELECT USING (true);

CREATE POLICY "Service role can insert wishlist entries" ON public.game_wishlist
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can delete wishlist entries" ON public.game_wishlist
    FOR DELETE USING (true);

CREATE POLICY "Admins can manage wishlist" ON public.game_wishlist
    FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ===========================================
-- Game Messages Policies
-- ===========================================
CREATE POLICY "Library owners can view messages for their games" ON public.game_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM games g
            JOIN libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        )
    );

CREATE POLICY "Library owners can update messages for their games" ON public.game_messages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM games g
            JOIN libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        )
    );

CREATE POLICY "Library owners can delete messages for their games" ON public.game_messages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM games g
            JOIN libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view messages" ON public.game_messages
    FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update messages" ON public.game_messages
    FOR UPDATE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete messages" ON public.game_messages
    FOR DELETE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert messages" ON public.game_messages
    FOR INSERT WITH CHECK (true);

-- ===========================================
-- Game Sessions Policies
-- ===========================================
CREATE POLICY "Sessions viewable by everyone" ON public.game_sessions
    FOR SELECT USING (true);

CREATE POLICY "Library owners can insert sessions for their games" ON public.game_sessions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM games g
            JOIN libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Library owners can update sessions for their games" ON public.game_sessions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM games g
            JOIN libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Library owners can delete sessions for their games" ON public.game_sessions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM games g
            JOIN libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR has_role(auth.uid(), 'admin')
    );

-- Session Players
CREATE POLICY "Session players viewable by everyone" ON public.game_session_players
    FOR SELECT USING (true);

CREATE POLICY "Library owners can insert session players" ON public.game_session_players
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM game_sessions gs
            JOIN games g ON g.id = gs.game_id
            JOIN libraries l ON l.id = g.library_id
            WHERE gs.id = session_id AND l.owner_id = auth.uid()
        ) OR has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Library owners can update session players" ON public.game_session_players
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM game_sessions gs
            JOIN games g ON g.id = gs.game_id
            JOIN libraries l ON l.id = g.library_id
            WHERE gs.id = session_id AND l.owner_id = auth.uid()
        ) OR has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Library owners can delete session players" ON public.game_session_players
    FOR DELETE USING (
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
CREATE POLICY "Users can view their own loan requests" ON public.game_loans
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

CREATE POLICY "Lenders can delete loan records" ON public.game_loans
    FOR DELETE USING (
        lender_user_id = auth.uid() OR has_role(auth.uid(), 'admin')
    );

-- ===========================================
-- Borrower Ratings Policies
-- ===========================================
CREATE POLICY "Anyone can view borrower ratings" ON public.borrower_ratings
    FOR SELECT USING (true);

CREATE POLICY "Lenders can rate borrowers after return" ON public.borrower_ratings
    FOR INSERT WITH CHECK (
        rated_by_user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM game_loans
            WHERE id = loan_id AND lender_user_id = auth.uid() AND status = 'returned'
        )
    );

-- ===========================================
-- Library Events Policies
-- ===========================================
CREATE POLICY "Public can view events in active libraries" ON public.library_events
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND is_active = true)
    );

CREATE POLICY "Library owners can manage their events" ON public.library_events
    FOR ALL USING (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND owner_id = auth.uid())
        OR has_role(auth.uid(), 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND owner_id = auth.uid())
        OR has_role(auth.uid(), 'admin')
    );

-- ===========================================
-- Game Polls Policies
-- ===========================================
CREATE POLICY "Anyone can view open polls" ON public.game_polls
    FOR SELECT USING (status IN ('open', 'closed'));

CREATE POLICY "Library owners can manage their polls" ON public.game_polls
    FOR ALL USING (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND owner_id = auth.uid())
        OR has_role(auth.uid(), 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND owner_id = auth.uid())
        OR has_role(auth.uid(), 'admin')
    );

-- ===========================================
-- Poll Options Policies
-- ===========================================
CREATE POLICY "Anyone can view poll options" ON public.poll_options
    FOR SELECT USING (true);

CREATE POLICY "Library owners can manage poll options" ON public.poll_options
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM game_polls gp
            JOIN libraries l ON l.id = gp.library_id
            WHERE gp.id = poll_id AND l.owner_id = auth.uid()
        ) OR has_role(auth.uid(), 'admin')
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM game_polls gp
            JOIN libraries l ON l.id = gp.library_id
            WHERE gp.id = poll_id AND l.owner_id = auth.uid()
        ) OR has_role(auth.uid(), 'admin')
    );

-- ===========================================
-- Poll Votes Policies
-- ===========================================
CREATE POLICY "Anyone can view poll votes" ON public.poll_votes
    FOR SELECT USING (true);

CREATE POLICY "Anyone can cast votes on open polls" ON public.poll_votes
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM game_polls
            WHERE id = poll_id AND status = 'open'
        )
    );

CREATE POLICY "Users can delete their own votes" ON public.poll_votes
    FOR DELETE USING (true);

-- ===========================================
-- Game Night RSVPs Policies
-- ===========================================
CREATE POLICY "Library owners can view RSVPs" ON public.game_night_rsvps
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM game_polls gp
            JOIN libraries l ON l.id = gp.library_id
            WHERE gp.id = poll_id AND l.owner_id = auth.uid()
        ) OR has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Members can manage their own RSVP" ON public.game_night_rsvps
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM game_polls gp
            WHERE gp.id = poll_id AND is_library_member(auth.uid(), gp.library_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM game_polls gp
            WHERE gp.id = poll_id AND is_library_member(auth.uid(), gp.library_id)
        )
    );

CREATE POLICY "Anyone can RSVP to public polls" ON public.game_night_rsvps
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM game_polls
            WHERE id = poll_id AND status = 'open'
        )
    );

-- ===========================================
-- Achievements Policies
-- ===========================================
CREATE POLICY "Achievements are viewable by everyone" ON public.achievements
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage achievements" ON public.achievements
    FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ===========================================
-- User Achievements Policies
-- ===========================================
CREATE POLICY "Anyone can view user achievements" ON public.user_achievements
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage user achievements" ON public.user_achievements
    FOR ALL USING (true);

-- ===========================================
-- Notification Preferences Policies
-- ===========================================
CREATE POLICY "Users can manage their preferences" ON public.notification_preferences
    FOR ALL USING (user_id = auth.uid());

-- ===========================================
-- Notification Log Policies
-- ===========================================
CREATE POLICY "Users can view their notifications" ON public.notification_log
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can mark notifications read" ON public.notification_log
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Service role can insert notifications" ON public.notification_log
    FOR INSERT WITH CHECK (true);

-- ===========================================
-- Push Subscriptions Policies
-- ===========================================
CREATE POLICY "Users can view their subscriptions" ON public.push_subscriptions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their subscriptions" ON public.push_subscriptions
    FOR ALL USING (user_id = auth.uid());

-- ===========================================
-- Platform Feedback Policies
-- ===========================================
CREATE POLICY "Anyone can submit feedback" ON public.platform_feedback
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view feedback" ON public.platform_feedback
    FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage feedback" ON public.platform_feedback
    FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ===========================================
-- Site Settings Policies
-- ===========================================
CREATE POLICY "Anyone can view site settings" ON public.site_settings
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage site settings" ON public.site_settings
    FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ===========================================
-- Library Suspensions Policies
-- ===========================================
CREATE POLICY "Admins can manage suspensions" ON public.library_suspensions
    FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ===========================================
-- Import Jobs Policies
-- ===========================================
CREATE POLICY "Library owners can view their import jobs" ON public.import_jobs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND owner_id = auth.uid())
    );

CREATE POLICY "Library owners can create import jobs" ON public.import_jobs
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND owner_id = auth.uid())
    );

CREATE POLICY "Service role can update import jobs" ON public.import_jobs
    FOR UPDATE USING (true);

-- ===========================================
-- Token Policies (deny all - use service role)
-- ===========================================
CREATE POLICY "Deny all direct access to tokens" ON public.password_reset_tokens
    FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "Deny all direct access to email tokens" ON public.email_confirmation_tokens
    FOR ALL USING (false) WITH CHECK (false);

-- ===========================================
-- Library Members Policies
-- ===========================================
CREATE POLICY "Anyone can view library members" ON public.library_members
    FOR SELECT USING (true);

CREATE POLICY "Users can join libraries" ON public.library_members
    FOR INSERT WITH CHECK (auth.uid() = user_id AND role = 'member');

CREATE POLICY "Users can leave libraries" ON public.library_members
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Library owners can manage members" ON public.library_members
    FOR ALL USING (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND owner_id = auth.uid())
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM libraries WHERE id = library_id AND owner_id = auth.uid())
    );

CREATE POLICY "Admins can manage all members" ON public.library_members
    FOR ALL USING (has_role(auth.uid(), 'admin'))
    WITH CHECK (has_role(auth.uid(), 'admin'));

-- ===========================================
-- Library Followers Policies
-- ===========================================
CREATE POLICY "Anyone can view library followers count" ON public.library_followers
    FOR SELECT USING (true);

CREATE POLICY "Users can follow libraries" ON public.library_followers
    FOR INSERT WITH CHECK (follower_user_id = auth.uid());

CREATE POLICY "Users can unfollow libraries" ON public.library_followers
    FOR DELETE USING (follower_user_id = auth.uid());
