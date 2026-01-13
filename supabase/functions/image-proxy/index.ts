import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_HOSTS = new Set(["cf.geekdo-images.com"]);

function browserLikeHeaders() {
  // Some CDNs block "non-browser" user agents. Mimic a modern browser as closely as we can.
  return {
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    // BGG is often required as referrer to satisfy hotlink checks.
    "Referer": "https://boardgamegeek.com/",
    "Origin": "https://boardgamegeek.com",
    // These are common browser fetch headers; harmless if ignored.
    "Sec-Fetch-Dest": "image",
    "Sec-Fetch-Mode": "no-cors",
    "Sec-Fetch-Site": "cross-site",
  } as Record<string, string>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    // Normalize %28%29 -> () because Geekdo's CDN sometimes rejects encoded parentheses.
    const normalizedTarget = target.replaceAll("%28", "(").replaceAll("%29", ")");

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

    // IMPORTANT: fetch using the normalized, *raw* string. The URL serializer
    // can percent-encode parentheses again, and Geekdo's CDN may reject that.
    const upstream = await fetch(normalizedTarget, {
      method: "GET",
      headers: browserLikeHeaders(),
      redirect: "follow",
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      console.error("image-proxy upstream error", upstream.status, normalizedTarget, text);
      return new Response("Upstream error", {
        status: 502,
        headers: corsHeaders,
      });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";

    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        // Cache aggressively; images are immutable by URL
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    console.error("image-proxy error", e);
    return new Response("Proxy error", { status: 500, headers: corsHeaders });
  }
});
