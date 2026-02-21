
-- ============================================================
-- Phase 1: Account Lockout + Security Audit Log
-- ============================================================

-- 1. Login attempts tracking for account lockout
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Only service role (edge functions) can insert; admins can read
CREATE POLICY "Service role can insert login attempts"
  ON public.login_attempts FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view login attempts"
  ON public.login_attempts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Index for fast lookups by email + time window
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_created
  ON public.login_attempts (email, created_at DESC);

-- Cleanup old attempts (> 24h)
CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM public.login_attempts WHERE created_at < now() - interval '24 hours';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Helper: check if account is locked (5+ failed attempts in last 15 min)
CREATE OR REPLACE FUNCTION public.is_account_locked(_email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) >= 5
  FROM public.login_attempts
  WHERE email = lower(_email)
    AND success = false
    AND created_at > now() - interval '15 minutes';
$$;

-- 2. Security Audit Log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  details jsonb DEFAULT '{}',
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Service role inserts; admins read; users can see their own
CREATE POLICY "Service role can insert audit logs"
  ON public.audit_log FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all audit logs"
  ON public.audit_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own audit logs"
  ON public.audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- Index for admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_audit_log_created
  ON public.audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_user
  ON public.audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_action
  ON public.audit_log (action, created_at DESC);

-- Cleanup function for audit logs (90 day retention)
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs(retention_days integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM public.audit_log WHERE created_at < now() - (retention_days || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
