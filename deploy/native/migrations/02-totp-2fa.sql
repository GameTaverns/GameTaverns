-- ═══════════════════════════════════════════════════════════════════════════
-- GameTaverns Native: Two-Factor Authentication (TOTP)
-- Version: 2.3.0 - Mandatory 2FA Support
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- TOTP Settings Table
-- Stores encrypted TOTP secrets and backup codes
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_totp_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    encrypted_secret TEXT NOT NULL,
    backup_codes_hash TEXT[], -- Hashed backup codes
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_totp_settings_user_id ON user_totp_settings(user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- TOTP Helper Function
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION user_has_totp_enabled(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_totp_settings
        WHERE user_id = _user_id AND is_enabled = true AND verified_at IS NOT NULL
    )
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TOTP Triggers
-- ═══════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS update_user_totp_settings_updated_at ON user_totp_settings;
CREATE TRIGGER update_user_totp_settings_updated_at 
    BEFORE UPDATE ON user_totp_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════════
-- Game Session Expansions Table (missing from base schema)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS game_session_expansions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    expansion_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(session_id, expansion_id)
);

CREATE INDEX IF NOT EXISTS idx_game_session_expansions_session ON game_session_expansions(session_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Push Subscriptions Table (for push notifications)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Update schema version
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE site_settings SET value = '2.3.0', updated_at = now() WHERE key = 'schema_version';
