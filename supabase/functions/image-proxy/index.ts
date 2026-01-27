const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============= Rate Limiting =============
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100; // Max 100 requests per minute per IP (more lenient for images)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getClientIP(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  // Cleanup old entries periodically
  if (rateLimitMap.size > 1000) {
    for (const [key, val] of rateLimitMap) {
      if (val.resetAt < now) rateLimitMap.delete(key);
    }
  }

  if (!record || record.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) return false;

  record.count++;
  return true;
}

const ALLOWED_HOSTS = new Set(["cf.geekdo-images.com"]);

function browserLikeHeaders() {
  // BGG requires specific headers; sometimes changing them helps avoid 400s
  return {
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Referer": "https://boardgamegeek.com/",
    "Origin": "https://boardgamegeek.com",
    "Sec-Fetch-Dest": "image",
    "Sec-Fetch-Mode": "no-cors",
    "Sec-Fetch-Site": "cross-site",
  } as Record<string, string>;
}

async function fetchImage(url: string): Promise<Response | null> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: browserLikeHeaders(),
      redirect: "follow",
    });
    
    if (response.ok && response.body) {
      return response;
    }
    console.log(`image-proxy: fetch failed for ${url} with status ${response.status}`);
  } catch (e) {
    console.log(`image-proxy: fetch error for ${url}:`, e);
  }
  return null;
}

// Export handler for self-hosted router
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting
  const clientIP = getClientIP(req);
  if (!checkRateLimit(clientIP)) {
    return new Response("Rate limit exceeded", {
      status: 429,
      headers: { ...corsHeaders, "Retry-After": "60" },
    });
  }

  if (req.method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const target = url.searchParams.get("url");

    if (!target) {
      return new Response("Missing url", { status: 400, headers: corsHeaders });
    }

    // Normalize problematic encoding - BGG CDN expects literal (unencoded) parentheses
    // but URL encoding through proxies often encodes them to %28/%29 which BGG rejects.
    let normalizedTarget = target
      // Strip bad scraping artifacts
      .replace(/&quot;.*$/, "")
      .replace(/;$/, "")
      // Decode any encoded parentheses - BGG wants literal ( and )
      .replace(/%2528/gi, "(")
      .replace(/%2529/gi, ")")
      .replace(/%28/gi, "(")
      .replace(/%29/gi, ")");

    let targetUrl: URL;
    try {
      targetUrl = new URL(normalizedTarget);
    } catch {
      return new Response("Invalid url", { status: 400, headers: corsHeaders });
    }

    if (targetUrl.protocol !== "https:") {
      return new Response("Invalid protocol", { status: 400, headers: corsHeaders });
    }

    if (!ALLOWED_HOSTS.has(targetUrl.hostname)) {
      return new Response("Host not allowed", { status: 403, headers: corsHeaders });
    }

    // Try fetching the image
    const successResponse = await fetchImage(normalizedTarget);

    if (!successResponse) {
      console.error("image-proxy: failed to fetch", normalizedTarget);

      // IMPORTANT: return a failing status so <img onError> triggers in the UI.
      // Returning a transparent 1x1 "success" response makes the UI look blank.
      return new Response("Failed to fetch image", {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    const contentType = successResponse.headers.get("content-type") || "image/jpeg";

    return new Response(successResponse.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    });
  } catch (e) {
    console.error("image-proxy error", e);
    return new Response("Proxy error", { status: 500, headers: corsHeaders });
  }
}

// For Lovable Cloud deployment (direct function invocation)
Deno.serve(handler);
