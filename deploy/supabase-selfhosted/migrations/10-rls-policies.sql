-- =============================================================================
-- GameTaverns Self-Hosted: Row Level Security Policies
-- Complete 1:1 parity with Lovable Cloud schema
-- Version: 2.3.2 - Schema Parity Audit
-- IMPORTANT: Uses DROP POLICY IF EXISTS for idempotent re-runs
-- =============================================================================

-- Enable RLS on all tables (safe to run multiple times)
DO $$
DECLARE
    tbl TEXT;
    tables_to_enable TEXT[] := ARRAY[
        'user_profiles', 'user_roles', 'libraries', 'library_settings',
        'library_members', 'library_followers', 'publishers', 'mechanics',
        'games', 'game_admin_data', 'game_mechanics', 'game_ratings',
        'game_wishlist', 'game_messages', 'game_sessions', 'game_session_players',
        'game_loans', 'borrower_ratings', 'library_events', 'game_polls',
        'poll_options', 'poll_votes', 'game_night_rsvps', 'achievements',
        'user_achievements', 'notification_preferences', 'notification_log',
        'push_subscriptions', 'platform_feedback', 'site_settings',
        'library_suspensions', 'import_jobs', 'password_reset_tokens',
        'email_confirmation_tokens'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables_to_enable LOOP
        EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', tbl);
    END LOOP;
END $$;

-- ===========================================
-- User Profiles Policies
-- ===========================================
DROP POLICY IF EXISTS "Users can view all profiles" ON public.user_profiles;
CREATE POLICY "Users can view all profiles" ON public.user_profiles
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert profiles" ON public.user_profiles;
CREATE POLICY "Service role can insert profiles" ON public.user_profiles
    FOR INSERT WITH CHECK (true);

-- ===========================================
-- User Roles Policies
-- ===========================================
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
    FOR SELECT USING (user_id = auth.uid());

-- ===========================================
-- Libraries Policies
-- ===========================================
DROP POLICY IF EXISTS "Anonymous users can view active libraries" ON public.libraries;
CREATE POLICY "Anonymous users can view active libraries" ON public.libraries
    FOR SELECT USING (auth.uid() IS NULL AND is_active = true);

DROP POLICY IF EXISTS "Authenticated users can view libraries" ON public.libraries;
CREATE POLICY "Authenticated users can view libraries" ON public.libraries
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Owners can manage their libraries" ON public.libraries;
CREATE POLICY "Owners can manage their libraries" ON public.libraries
    FOR ALL USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Admins can manage all libraries" ON public.libraries;
CREATE POLICY "Admins can manage all libraries" ON public.libraries
    FOR ALL USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can create libraries" ON public.libraries;
CREATE POLICY "Authenticated users can create libraries" ON public.libraries
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- ===========================================
-- Library Settings Policies
-- ===========================================
DROP POLICY IF EXISTS "Library owners can view their settings" ON public.library_settings;
CREATE POLICY "Library owners can view their settings" ON public.library_settings
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
    );

DROP POLICY IF EXISTS "Library owners can manage settings" ON public.library_settings;
CREATE POLICY "Library owners can manage settings" ON public.library_settings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
    );

-- ===========================================
-- Publishers Policies
-- ===========================================
DROP POLICY IF EXISTS "Anyone can view publishers" ON public.publishers;
CREATE POLICY "Anyone can view publishers" ON public.publishers
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage publishers" ON public.publishers;
CREATE POLICY "Admins can manage publishers" ON public.publishers
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ===========================================
-- Mechanics Policies
-- ===========================================
DROP POLICY IF EXISTS "Anyone can view mechanics" ON public.mechanics;
CREATE POLICY "Anyone can view mechanics" ON public.mechanics
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage mechanics" ON public.mechanics;
CREATE POLICY "Admins can manage mechanics" ON public.mechanics
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ===========================================
-- Games Policies
-- ===========================================
DROP POLICY IF EXISTS "Public can view games in active libraries" ON public.games;
CREATE POLICY "Public can view games in active libraries" ON public.games
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND is_active = true)
    );

DROP POLICY IF EXISTS "Library owners can view their games" ON public.games;
CREATE POLICY "Library owners can view their games" ON public.games
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
    );

DROP POLICY IF EXISTS "Library owners can insert games" ON public.games;
CREATE POLICY "Library owners can insert games" ON public.games
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
    );

DROP POLICY IF EXISTS "Library owners can update their games" ON public.games;
CREATE POLICY "Library owners can update their games" ON public.games
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
    );

DROP POLICY IF EXISTS "Library owners can delete their games" ON public.games;
CREATE POLICY "Library owners can delete their games" ON public.games
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
    );

-- ===========================================
-- Game Admin Data Policies
-- ===========================================
DROP POLICY IF EXISTS "Library owners can view their game admin data" ON public.game_admin_data;
CREATE POLICY "Library owners can view their game admin data" ON public.game_admin_data
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.games g
            JOIN public.libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR public.has_role(auth.uid(), 'admin')
    );

DROP POLICY IF EXISTS "Library owners can insert game admin data" ON public.game_admin_data;
CREATE POLICY "Library owners can insert game admin data" ON public.game_admin_data
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.games g
            JOIN public.libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR public.has_role(auth.uid(), 'admin')
    );

DROP POLICY IF EXISTS "Library owners can update game admin data" ON public.game_admin_data;
CREATE POLICY "Library owners can update game admin data" ON public.game_admin_data
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.games g
            JOIN public.libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR public.has_role(auth.uid(), 'admin')
    );

DROP POLICY IF EXISTS "Library owners can delete game admin data" ON public.game_admin_data;
CREATE POLICY "Library owners can delete game admin data" ON public.game_admin_data
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.games g
            JOIN public.libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR public.has_role(auth.uid(), 'admin')
    );

DROP POLICY IF EXISTS "Admins can view game admin data" ON public.game_admin_data;
CREATE POLICY "Admins can view game admin data" ON public.game_admin_data
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert game admin data" ON public.game_admin_data;
CREATE POLICY "Admins can insert game admin data" ON public.game_admin_data
    FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update game admin data" ON public.game_admin_data;
CREATE POLICY "Admins can update game admin data" ON public.game_admin_data
    FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete game admin data" ON public.game_admin_data;
CREATE POLICY "Admins can delete game admin data" ON public.game_admin_data
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- ===========================================
-- Game Mechanics Policies
-- ===========================================
DROP POLICY IF EXISTS "Game mechanics are viewable by everyone" ON public.game_mechanics;
CREATE POLICY "Game mechanics are viewable by everyone" ON public.game_mechanics
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Library owners can insert game_mechanics" ON public.game_mechanics;
CREATE POLICY "Library owners can insert game_mechanics" ON public.game_mechanics
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.games g
            JOIN public.libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR public.has_role(auth.uid(), 'admin')
    );

DROP POLICY IF EXISTS "Library owners can update game_mechanics" ON public.game_mechanics;
CREATE POLICY "Library owners can update game_mechanics" ON public.game_mechanics
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.games g
            JOIN public.libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR public.has_role(auth.uid(), 'admin')
    );

DROP POLICY IF EXISTS "Library owners can delete game_mechanics" ON public.game_mechanics;
CREATE POLICY "Library owners can delete game_mechanics" ON public.game_mechanics
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.games g
            JOIN public.libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR public.has_role(auth.uid(), 'admin')
    );

DROP POLICY IF EXISTS "Admins can insert game_mechanics" ON public.game_mechanics;
CREATE POLICY "Admins can insert game_mechanics" ON public.game_mechanics
    FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update game_mechanics" ON public.game_mechanics;
CREATE POLICY "Admins can update game_mechanics" ON public.game_mechanics
    FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete game_mechanics" ON public.game_mechanics;
CREATE POLICY "Admins can delete game_mechanics" ON public.game_mechanics
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- ===========================================
-- Game Ratings Policies (service role for insert/update)
-- ===========================================
DROP POLICY IF EXISTS "Admins can view all ratings" ON public.game_ratings;
CREATE POLICY "Admins can view all ratings" ON public.game_ratings
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Library owners can view their game ratings via view" ON public.game_ratings;
CREATE POLICY "Library owners can view their game ratings via view" ON public.game_ratings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.games g
            JOIN public.libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admins can delete ratings" ON public.game_ratings;
CREATE POLICY "Admins can delete ratings" ON public.game_ratings
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- ===========================================
-- Game Wishlist Policies
-- ===========================================
DROP POLICY IF EXISTS "Anyone can view wishlist entries for summaries" ON public.game_wishlist;
CREATE POLICY "Anyone can view wishlist entries for summaries" ON public.game_wishlist
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can insert wishlist entries" ON public.game_wishlist;
CREATE POLICY "Service role can insert wishlist entries" ON public.game_wishlist
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can delete wishlist entries" ON public.game_wishlist;
CREATE POLICY "Service role can delete wishlist entries" ON public.game_wishlist
    FOR DELETE USING (true);

DROP POLICY IF EXISTS "Admins can manage wishlist" ON public.game_wishlist;
CREATE POLICY "Admins can manage wishlist" ON public.game_wishlist
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ===========================================
-- Game Messages Policies
-- ===========================================
DROP POLICY IF EXISTS "Library owners can view messages for their games" ON public.game_messages;
CREATE POLICY "Library owners can view messages for their games" ON public.game_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.games g
            JOIN public.libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Library owners can update messages for their games" ON public.game_messages;
CREATE POLICY "Library owners can update messages for their games" ON public.game_messages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.games g
            JOIN public.libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Library owners can delete messages for their games" ON public.game_messages;
CREATE POLICY "Library owners can delete messages for their games" ON public.game_messages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.games g
            JOIN public.libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admins can view messages" ON public.game_messages;
CREATE POLICY "Admins can view messages" ON public.game_messages
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update messages" ON public.game_messages;
CREATE POLICY "Admins can update messages" ON public.game_messages
    FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete messages" ON public.game_messages;
CREATE POLICY "Admins can delete messages" ON public.game_messages
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Service role can insert messages" ON public.game_messages;
CREATE POLICY "Service role can insert messages" ON public.game_messages
    FOR INSERT WITH CHECK (true);

-- ===========================================
-- Game Sessions Policies
-- ===========================================
DROP POLICY IF EXISTS "Sessions viewable by everyone" ON public.game_sessions;
CREATE POLICY "Sessions viewable by everyone" ON public.game_sessions
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Library owners can insert sessions for their games" ON public.game_sessions;
CREATE POLICY "Library owners can insert sessions for their games" ON public.game_sessions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.games g
            JOIN public.libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR public.has_role(auth.uid(), 'admin')
    );

DROP POLICY IF EXISTS "Library owners can update sessions for their games" ON public.game_sessions;
CREATE POLICY "Library owners can update sessions for their games" ON public.game_sessions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.games g
            JOIN public.libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR public.has_role(auth.uid(), 'admin')
    );

DROP POLICY IF EXISTS "Library owners can delete sessions for their games" ON public.game_sessions;
CREATE POLICY "Library owners can delete sessions for their games" ON public.game_sessions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.games g
            JOIN public.libraries l ON l.id = g.library_id
            WHERE g.id = game_id AND l.owner_id = auth.uid()
        ) OR public.has_role(auth.uid(), 'admin')
    );

-- Session Players
DROP POLICY IF EXISTS "Session players viewable by everyone" ON public.game_session_players;
CREATE POLICY "Session players viewable by everyone" ON public.game_session_players
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Library owners can insert session players" ON public.game_session_players;
CREATE POLICY "Library owners can insert session players" ON public.game_session_players
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.game_sessions gs
            JOIN public.games g ON g.id = gs.game_id
            JOIN public.libraries l ON l.id = g.library_id
            WHERE gs.id = session_id AND l.owner_id = auth.uid()
        ) OR public.has_role(auth.uid(), 'admin')
    );

DROP POLICY IF EXISTS "Library owners can update session players" ON public.game_session_players;
CREATE POLICY "Library owners can update session players" ON public.game_session_players
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.game_sessions gs
            JOIN public.games g ON g.id = gs.game_id
            JOIN public.libraries l ON l.id = g.library_id
            WHERE gs.id = session_id AND l.owner_id = auth.uid()
        ) OR public.has_role(auth.uid(), 'admin')
    );

DROP POLICY IF EXISTS "Library owners can delete session players" ON public.game_session_players;
CREATE POLICY "Library owners can delete session players" ON public.game_session_players
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.game_sessions gs
            JOIN public.games g ON g.id = gs.game_id
            JOIN public.libraries l ON l.id = g.library_id
            WHERE gs.id = session_id AND l.owner_id = auth.uid()
        ) OR public.has_role(auth.uid(), 'admin')
    );

-- ===========================================
-- Game Loans Policies
-- ===========================================
DROP POLICY IF EXISTS "Users can view their own loan requests" ON public.game_loans;
CREATE POLICY "Users can view their own loan requests" ON public.game_loans
    FOR SELECT USING (
        borrower_user_id = auth.uid() OR lender_user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
    );

DROP POLICY IF EXISTS "Members can request loans" ON public.game_loans;
CREATE POLICY "Members can request loans" ON public.game_loans
    FOR INSERT WITH CHECK (
        borrower_user_id = auth.uid() AND public.is_library_member(auth.uid(), library_id)
    );

DROP POLICY IF EXISTS "Lenders and borrowers can update loans" ON public.game_loans;
CREATE POLICY "Lenders and borrowers can update loans" ON public.game_loans
    FOR UPDATE USING (
        borrower_user_id = auth.uid() OR lender_user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
    );

DROP POLICY IF EXISTS "Lenders can delete loan records" ON public.game_loans;
CREATE POLICY "Lenders can delete loan records" ON public.game_loans
    FOR DELETE USING (
        lender_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
    );

-- ===========================================
-- Borrower Ratings Policies (Hardened for Security)
-- Only visible to: rater, rated user, library owner, or admin
-- ===========================================
DROP POLICY IF EXISTS "Anyone can view borrower ratings" ON public.borrower_ratings;
DROP POLICY IF EXISTS "Users can view ratings for their loans" ON public.borrower_ratings;
CREATE POLICY "Users can view ratings for their loans" ON public.borrower_ratings
    FOR SELECT USING (
        auth.uid() = rated_by_user_id
        OR auth.uid() = rated_user_id
        OR EXISTS (
            SELECT 1 FROM public.game_loans gl
            JOIN public.libraries l ON l.id = gl.library_id
            WHERE gl.id = loan_id AND l.owner_id = auth.uid()
        )
        OR public.has_role(auth.uid(), 'admin')
    );

DROP POLICY IF EXISTS "Lenders can rate borrowers after return" ON public.borrower_ratings;
CREATE POLICY "Lenders can rate borrowers after return" ON public.borrower_ratings
    FOR INSERT WITH CHECK (
        rated_by_user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.game_loans
            WHERE id = loan_id AND lender_user_id = auth.uid() AND status = 'returned'
        )
    );

-- ===========================================
-- Library Events Policies
-- ===========================================
DROP POLICY IF EXISTS "Public can view events in active libraries" ON public.library_events;
CREATE POLICY "Public can view events in active libraries" ON public.library_events
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND is_active = true)
    );

DROP POLICY IF EXISTS "Library owners can manage their events" ON public.library_events;
CREATE POLICY "Library owners can manage their events" ON public.library_events
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
    );

-- ===========================================
-- Game Polls Policies
-- ===========================================
DROP POLICY IF EXISTS "Anyone can view open polls" ON public.game_polls;
CREATE POLICY "Anyone can view open polls" ON public.game_polls
    FOR SELECT USING (status IN ('open', 'closed'));

DROP POLICY IF EXISTS "Library owners can manage their polls" ON public.game_polls;
CREATE POLICY "Library owners can manage their polls" ON public.game_polls
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
    );

-- ===========================================
-- Poll Options Policies
-- ===========================================
DROP POLICY IF EXISTS "Anyone can view poll options" ON public.poll_options;
CREATE POLICY "Anyone can view poll options" ON public.poll_options
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Library owners can manage poll options" ON public.poll_options;
CREATE POLICY "Library owners can manage poll options" ON public.poll_options
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.game_polls gp
            JOIN public.libraries l ON l.id = gp.library_id
            WHERE gp.id = poll_id AND l.owner_id = auth.uid()
        ) OR public.has_role(auth.uid(), 'admin')
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.game_polls gp
            JOIN public.libraries l ON l.id = gp.library_id
            WHERE gp.id = poll_id AND l.owner_id = auth.uid()
        ) OR public.has_role(auth.uid(), 'admin')
    );

-- ===========================================
-- Poll Votes Policies
-- ===========================================
DROP POLICY IF EXISTS "Anyone can view poll votes" ON public.poll_votes;
CREATE POLICY "Anyone can view poll votes" ON public.poll_votes
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can cast votes on open polls" ON public.poll_votes;
CREATE POLICY "Anyone can cast votes on open polls" ON public.poll_votes
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.game_polls
            WHERE id = poll_id AND status = 'open'
        )
    );

DROP POLICY IF EXISTS "Users can delete their own votes" ON public.poll_votes;
CREATE POLICY "Users can delete their own votes" ON public.poll_votes
    FOR DELETE USING (true);

-- ===========================================
-- Game Night RSVPs Policies
-- ===========================================
DROP POLICY IF EXISTS "Library owners can view RSVPs" ON public.game_night_rsvps;
CREATE POLICY "Library owners can view RSVPs" ON public.game_night_rsvps
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.game_polls gp
            JOIN public.libraries l ON l.id = gp.library_id
            WHERE gp.id = poll_id AND l.owner_id = auth.uid()
        ) OR public.has_role(auth.uid(), 'admin')
    );

DROP POLICY IF EXISTS "Members can manage their own RSVP" ON public.game_night_rsvps;
CREATE POLICY "Members can manage their own RSVP" ON public.game_night_rsvps
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.game_polls gp
            WHERE gp.id = poll_id AND public.is_library_member(auth.uid(), gp.library_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.game_polls gp
            WHERE gp.id = poll_id AND public.is_library_member(auth.uid(), gp.library_id)
        )
    );

DROP POLICY IF EXISTS "Anyone can RSVP to public polls" ON public.game_night_rsvps;
CREATE POLICY "Anyone can RSVP to public polls" ON public.game_night_rsvps
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.game_polls
            WHERE id = poll_id AND status = 'open'
        )
    );

-- ===========================================
-- Achievements Policies
-- ===========================================
DROP POLICY IF EXISTS "Achievements are viewable by everyone" ON public.achievements;
CREATE POLICY "Achievements are viewable by everyone" ON public.achievements
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage achievements" ON public.achievements;
CREATE POLICY "Admins can manage achievements" ON public.achievements
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ===========================================
-- User Achievements Policies
-- ===========================================
DROP POLICY IF EXISTS "Anyone can view user achievements" ON public.user_achievements;
CREATE POLICY "Anyone can view user achievements" ON public.user_achievements
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage user achievements" ON public.user_achievements;
CREATE POLICY "Service role can manage user achievements" ON public.user_achievements
    FOR ALL USING (true);

-- ===========================================
-- Notification Preferences Policies
-- ===========================================
DROP POLICY IF EXISTS "Users can manage their preferences" ON public.notification_preferences;
CREATE POLICY "Users can manage their preferences" ON public.notification_preferences
    FOR ALL USING (user_id = auth.uid());

-- ===========================================
-- Notification Log Policies
-- ===========================================
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notification_log;
CREATE POLICY "Users can view their notifications" ON public.notification_log
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can mark notifications read" ON public.notification_log;
CREATE POLICY "Users can mark notifications read" ON public.notification_log
    FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notification_log;
CREATE POLICY "Service role can insert notifications" ON public.notification_log
    FOR INSERT WITH CHECK (true);

-- ===========================================
-- Push Subscriptions Policies
-- ===========================================
DROP POLICY IF EXISTS "Users can view their subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view their subscriptions" ON public.push_subscriptions
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage their subscriptions" ON public.push_subscriptions
    FOR ALL USING (user_id = auth.uid());

-- ===========================================
-- Platform Feedback Policies
-- ===========================================
DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.platform_feedback;
CREATE POLICY "Anyone can submit feedback" ON public.platform_feedback
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view feedback" ON public.platform_feedback;
CREATE POLICY "Admins can view feedback" ON public.platform_feedback
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage feedback" ON public.platform_feedback;
CREATE POLICY "Admins can manage feedback" ON public.platform_feedback
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ===========================================
-- Site Settings Policies
-- ===========================================
DROP POLICY IF EXISTS "Anyone can view site settings" ON public.site_settings;
CREATE POLICY "Anyone can view site settings" ON public.site_settings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage site settings" ON public.site_settings;
CREATE POLICY "Admins can manage site settings" ON public.site_settings
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ===========================================
-- Library Suspensions Policies
-- ===========================================
DROP POLICY IF EXISTS "Admins can manage suspensions" ON public.library_suspensions;
CREATE POLICY "Admins can manage suspensions" ON public.library_suspensions
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ===========================================
-- Import Jobs Policies
-- ===========================================
DROP POLICY IF EXISTS "Library owners can view their import jobs" ON public.import_jobs;
CREATE POLICY "Library owners can view their import jobs" ON public.import_jobs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
    );

DROP POLICY IF EXISTS "Library owners can create import jobs" ON public.import_jobs;
CREATE POLICY "Library owners can create import jobs" ON public.import_jobs
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
    );

DROP POLICY IF EXISTS "Service role can update import jobs" ON public.import_jobs;
CREATE POLICY "Service role can update import jobs" ON public.import_jobs
    FOR UPDATE USING (true);

-- ===========================================
-- Token Policies (deny all - use service role)
-- ===========================================
DROP POLICY IF EXISTS "Deny all direct access to tokens" ON public.password_reset_tokens;
CREATE POLICY "Deny all direct access to tokens" ON public.password_reset_tokens
    FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny all direct access to email tokens" ON public.email_confirmation_tokens;
CREATE POLICY "Deny all direct access to email tokens" ON public.email_confirmation_tokens
    FOR ALL USING (false) WITH CHECK (false);

-- ===========================================
-- Library Members Policies
-- Security Hardened: User IDs not exposed to public
-- ===========================================
DROP POLICY IF EXISTS "Anyone can view library members" ON public.library_members;
DROP POLICY IF EXISTS "Authenticated users can view library members" ON public.library_members;
CREATE POLICY "Authenticated users can view library members" ON public.library_members
    FOR SELECT 
    TO authenticated
    USING (
        -- Users can see members of libraries they're part of
        public.is_library_member(auth.uid(), library_id)
        -- Or if they're an admin
        OR public.has_role(auth.uid(), 'admin')
    );

DROP POLICY IF EXISTS "Users can join libraries" ON public.library_members;
CREATE POLICY "Users can join libraries" ON public.library_members
    FOR INSERT WITH CHECK (auth.uid() = user_id AND role = 'member');

DROP POLICY IF EXISTS "Users can leave libraries" ON public.library_members;
CREATE POLICY "Users can leave libraries" ON public.library_members
    FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Library owners can manage members" ON public.library_members;
CREATE POLICY "Library owners can manage members" ON public.library_members
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.libraries WHERE id = library_id AND owner_id = auth.uid())
    );

DROP POLICY IF EXISTS "Admins can manage all members" ON public.library_members;
CREATE POLICY "Admins can manage all members" ON public.library_members
    FOR ALL USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ===========================================
-- Library Followers Policies
-- ===========================================
DROP POLICY IF EXISTS "Anyone can view library followers count" ON public.library_followers;
CREATE POLICY "Anyone can view library followers count" ON public.library_followers
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can follow libraries" ON public.library_followers;
CREATE POLICY "Users can follow libraries" ON public.library_followers
    FOR INSERT WITH CHECK (follower_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can unfollow libraries" ON public.library_followers;
CREATE POLICY "Users can unfollow libraries" ON public.library_followers
    FOR DELETE USING (follower_user_id = auth.uid());
