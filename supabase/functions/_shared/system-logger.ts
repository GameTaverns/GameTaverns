/**
 * Shared system logger for edge functions.
 * Logs requests and events to the system_logs table for monitoring.
 * All logging is fire-and-forget to avoid blocking responses.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
  library_id?: string;
  user_id?: string;
}

/** Get a service-role Supabase client for logging */
function getLogClient() {
  const url = Deno.env.get("SUPABASE_URL") || Deno.env.get("API_EXTERNAL_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Fire-and-forget log to system_logs table.
 * Never throws; silently fails if DB is unavailable.
 */
export async function logEvent(entry: LogEntry): Promise<void> {
  try {
    const client = getLogClient();
    if (!client) return;

    const { error } = await client
      .from("system_logs")
      .insert({
        level: entry.level,
        source: entry.source,
        message: entry.message,
        metadata: entry.metadata || {},
        library_id: entry.library_id || null,
        user_id: entry.user_id || null,
      });

    if (error) console.error("[system-logger] Insert failed:", error.message);
  } catch (e) {
    console.error("[system-logger] logEvent error:", e);
  }
}

/**
 * Map function name to log source category.
 * Groups related functions for cleaner log filtering.
 */
function getSourceCategory(functionName: string): string {
  if (functionName.startsWith("discord-")) return "discord";
  if (functionName.startsWith("totp-")) return "auth";
  if (functionName.startsWith("bgg-")) return "bgg";
  
  const sourceMap: Record<string, string> = {
    "signup": "auth",
    "verify-email": "auth",
    "send-auth-email": "auth",
    "verify-reset-token": "auth",
    "resolve-username": "auth",
    "manage-account": "auth",
    "manage-users": "auth",
    "game-import": "import",
    "bulk-import": "import",
    "game-recommendations": "games",
    "rate-game": "games",
    "refresh-images": "games",
    "condense-descriptions": "games",
    "image-proxy": "games",
    "send-message": "messages",
    "decrypt-messages": "messages",
    "my-inquiries": "messages",
    "reply-to-inquiry": "messages",
    "send-inquiry-reply": "messages",
    "notify-feedback": "messages",
    "wishlist": "games",
    "membership": "membership",
    "library-settings": "settings",
    "profile-update": "settings",
    "sync-achievements": "achievements",
    "clubs": "clubs",
    "check-login": "auth",
    "system-health": "system",
  };
  
  return sourceMap[functionName] || functionName;
}

/**
 * Extract user ID from Authorization header (if present).
 * Does NOT verify the token - just extracts the sub claim from JWT payload.
 * This is for logging only; actual auth is handled by each function.
 */
function extractUserIdFromHeader(req: Request): string | undefined {
  try {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) return undefined;
    const token = auth.slice(7);
    const parts = token.split(".");
    if (parts.length !== 3) return undefined;
    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Wrap an edge function handler with automatic request/response logging.
 * Logs: function invocation, duration, status code, errors.
 * 
 * Usage:
 *   export default withLogging("function-name", handler);
 */
export function withLogging(
  functionName: string,
  handler: (req: Request) => Promise<Response> | Response,
): (req: Request) => Promise<Response> {
  const source = getSourceCategory(functionName);

  return async (req: Request): Promise<Response> => {
    // Skip logging for OPTIONS (CORS preflight)
    if (req.method === "OPTIONS") {
      return handler(req);
    }

    const start = Date.now();
    const userId = extractUserIdFromHeader(req);

    try {
      const response = await handler(req);
      const durationMs = Date.now() - start;
      const status = response.status;

      // Log errors and slow requests; skip noisy success logs for high-volume endpoints
      const isHighVolume = functionName === "image-proxy";
      const shouldLog = status >= 400 || durationMs > 5000 || !isHighVolume;

      if (shouldLog) {
        await logEvent({
          level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
          source,
          message: `${functionName} ${req.method} → ${status} (${durationMs}ms)`,
          metadata: {
            function: functionName,
            method: req.method,
            status,
            duration_ms: durationMs,
            ...(status >= 400 ? { url: req.url } : {}),
          },
          user_id: userId,
        });
      }

      return response;
    } catch (error) {
      const durationMs = Date.now() - start;
      await logEvent({
        level: "error",
        source,
        message: `${functionName} ${req.method} CRASHED (${durationMs}ms): ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          function: functionName,
          method: req.method,
          duration_ms: durationMs,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        user_id: userId,
      });
      throw error;
    }
  };
}
