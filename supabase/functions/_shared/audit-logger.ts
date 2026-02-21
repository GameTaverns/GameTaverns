/**
 * Shared audit logger for security-sensitive events.
 * Writes to the audit_log table using the service role.
 * Always awaited — must complete before response is sent (self-hosted runtime constraint).
 */

import { createClient } from "npm:@supabase/supabase-js@2";

export type AuditAction =
  | "login_success"
  | "login_failed"
  | "login_locked"
  | "signup"
  | "password_change"
  | "password_reset_request"
  | "password_reset_complete"
  | "totp_enabled"
  | "totp_disabled"
  | "totp_verified"
  | "role_changed"
  | "account_deleted"
  | "profile_updated"
  | "email_changed";

interface AuditEntry {
  userId?: string;
  action: AuditAction;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

function getAuditClient() {
  const url = Deno.env.get("SUPABASE_URL") || Deno.env.get("API_EXTERNAL_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Log a security audit event. Awaited to ensure it completes before
 * the edge runtime terminates the isolate.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const client = getAuditClient();
    if (!client) return;

    const { error } = await client.from("audit_log").insert({
      user_id: entry.userId || null,
      action: entry.action,
      details: entry.details || {},
      ip_address: entry.ipAddress || null,
    });

    if (error) console.error("[audit-logger] Insert failed:", error.message);
  } catch (e) {
    console.error("[audit-logger] Error:", e);
  }
}

/**
 * Record a login attempt (success or failure) for account lockout tracking.
 */
export async function recordLoginAttempt(email: string, success: boolean, ipAddress?: string): Promise<void> {
  try {
    const client = getAuditClient();
    if (!client) return;

    await client.from("login_attempts").insert({
      email: email.toLowerCase(),
      ip_address: ipAddress || null,
      success,
    });
  } catch (e) {
    console.error("[audit-logger] recordLoginAttempt error:", e);
  }
}

/**
 * Check if an account is currently locked out (5+ failed attempts in 15 min).
 */
export async function isAccountLocked(email: string): Promise<boolean> {
  try {
    const client = getAuditClient();
    if (!client) return false;

    const { data, error } = await client.rpc("is_account_locked", {
      _email: email.toLowerCase(),
    });

    if (error) {
      console.error("[audit-logger] isAccountLocked RPC error:", error.message);
      return false; // Fail open
    }

    return !!data;
  } catch (e) {
    console.error("[audit-logger] isAccountLocked error:", e);
    return false; // Fail open
  }
}

/**
 * Extract client IP from request headers.
 */
export function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip")
    || req.headers.get("x-real-ip")
    || "unknown";
}
