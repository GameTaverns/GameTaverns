/**
 * Shared CORS headers for edge functions.
 * 
 * In self-hosted environments, the Origin header is validated against
 * CORS_ORIGINS (comma-separated) from environment variables.
 * Falls back to the site URL or allows all origins in development.
 */

const ALLOWED_HEADERS = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "x-native-app-token",
  "x-supabase-client-platform",
  "x-supabase-client-platform-version",
  "x-supabase-client-runtime",
  "x-supabase-client-runtime-version",
].join(", ");

function getAllowedOrigins(): string[] {
  // Check for explicit CORS_ORIGINS config
  const corsOrigins = Deno.env.get("CORS_ORIGINS");
  if (corsOrigins) {
    return corsOrigins.split(",").map((o) => o.trim()).filter(Boolean);
  }

  // Fall back to SITE_URL
  const siteUrl = Deno.env.get("SITE_URL");
  if (siteUrl) {
    return [siteUrl];
  }

  // Development fallback
  return ["*"];
}

function matchesOrigin(origin: string, allowed: string[]): boolean {
  if (allowed.includes("*")) return true;

  for (const pattern of allowed) {
    // Exact match
    if (origin === pattern) return true;

    // Wildcard subdomain match: https://*.example.com
    if (pattern.includes("*")) {
      const regex = new RegExp(
        "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, "[a-z0-9-]+") + "$",
        "i"
      );
      if (regex.test(origin)) return true;
    }
  }
  return false;
}

/**
 * Build CORS headers for the given request.
 * Returns the appropriate Access-Control-Allow-Origin based on the
 * request's Origin header and the server's allowed origins configuration.
 */
export function getCorsHeaders(req?: Request): Record<string, string> {
  const allowed = getAllowedOrigins();

  // If wildcard, just return *
  if (allowed.includes("*")) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": ALLOWED_HEADERS,
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    };
  }

  const origin = req?.headers.get("origin") || "";
  const matched = matchesOrigin(origin, allowed);

  return {
    "Access-Control-Allow-Origin": matched ? origin : allowed[0],
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Vary": "Origin",
  };
}

/**
 * Handle CORS preflight (OPTIONS) requests.
 * Returns a Response if it's a preflight, or null if the request should continue.
 */
export function handleCorsPreFlight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  return null;
}
