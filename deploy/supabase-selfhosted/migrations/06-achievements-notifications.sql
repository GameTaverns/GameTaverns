-- =============================================================================
-- GameTaverns Self-Hosted: Achievements & Notifications
-- Version: 2.2.0 - 5-Tier Role Hierarchy
-- =============================================================================

-- ===========================================
-- Achievements (global definitions)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category achievement_category NOT NULL,
    icon TEXT,
    points INTEGER NOT NULL DEFAULT 10,
    tier INTEGER NOT NULL DEFAULT 1,
    requirement_type TEXT NOT NULL,
    requirement_value INTEGER NOT NULL,
    is_secret BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- User Achievements (earned)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON public.user_achievements(user_id);

-- ===========================================
-- Notification Preferences
-- ===========================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    
    -- Email notifications
    email_loan_requests BOOLEAN DEFAULT true,
    email_loan_updates BOOLEAN DEFAULT true,
    email_event_reminders BOOLEAN DEFAULT true,
    email_wishlist_alerts BOOLEAN DEFAULT true,
    email_achievement_earned BOOLEAN DEFAULT true,
    
    -- Push notifications
    push_loan_requests BOOLEAN DEFAULT true,
    push_loan_updates BOOLEAN DEFAULT true,
    push_event_reminders BOOLEAN DEFAULT true,
    push_wishlist_alerts BOOLEAN DEFAULT true,
    push_achievement_earned BOOLEAN DEFAULT true,
    
    -- Discord notifications
    discord_loan_requests BOOLEAN DEFAULT true,
    discord_loan_updates BOOLEAN DEFAULT true,
    discord_event_reminders BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- Notification Log
-- ===========================================
CREATE TABLE IF NOT EXISTS public.notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    notification_type TEXT NOT NULL,
    channel TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    metadata JSONB,
    read_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_user ON public.notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_unread ON public.notification_log(user_id) WHERE read_at IS NULL;

-- ===========================================
-- Push Subscriptions
-- ===========================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);
