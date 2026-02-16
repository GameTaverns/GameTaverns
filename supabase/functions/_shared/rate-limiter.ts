/**
 * In-memory sliding-window rate limiter for self-hosted edge functions.
 * 
 * Since the self-hosted dispatcher (`main/index.ts`) runs as a single
 * long-lived Deno process, in-memory tracking is reliable and fast.
 * Entries auto-expire to prevent memory leaks.
 * 
 * Usage:
 *   import { checkRateLimit } from "../_shared/rate-limiter.ts";
 *   const result = checkRateLimit("signup", clientIp, { maxRequests: 5, windowMs: 60_000 });
 *   if (!result.allowed) return new Response(..., { status: 429 });
 */

interface RateLimitEntry {
  timestamps: number[];
}

// Global store keyed by "namespace:identifier"
const store = new Map<string, RateLimitEntry>();

// Periodic cleanup every 5 minutes
let cleanupScheduled = false;
function scheduleCleanup() {
  if (cleanupScheduled) return;
  cleanupScheduled = true;
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      // Remove entries with no recent timestamps (older than 1 hour)
      entry.timestamps = entry.timestamps.filter(t => now - t < 3_600_000);
      if (entry.timestamps.length === 0) store.delete(key);
    }
  }, 300_000); // 5 min
}

export interface RateLimitOptions {
  /** Max requests allowed in the window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

/**
 * Check if a request is within rate limits.
 * @param namespace Function name (e.g. "signup", "reply-to-inquiry")
 * @param identifier Client identifier (IP, user ID, etc.)
 * @param options Rate limit configuration
 */
export function checkRateLimit(
  namespace: string,
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  scheduleCleanup();

  const key = `${namespace}:${identifier}`;
  const now = Date.now();
  const windowStart = now - options.windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Prune expired timestamps
  entry.timestamps = entry.timestamps.filter(t => t > windowStart);

  if (entry.timestamps.length >= options.maxRequests) {
    // Find when the oldest request in the window expires
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + options.windowMs - now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, retryAfterMs),
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: options.maxRequests - entry.timestamps.length,
  };
}

/**
 * Create a standard 429 response with rate limit headers.
 */
export function rateLimitResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string>,
  message = "Too many requests. Please try again later."
): Response {
  return new Response(
    JSON.stringify({ error: message, retryAfterMs: result.retryAfterMs }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        ...(result.retryAfterMs ? { "Retry-After": String(Math.ceil((result.retryAfterMs) / 1000)) } : {}),
      },
    }
  );
}
