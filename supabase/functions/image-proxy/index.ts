const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_HOSTS = new Set(["cf.geekdo-images.com"]);

function browserLikeHeaders() {
  // Keep this minimal; some CDNs reject overly-specific browser headers.
  return {
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Encoding": "identity",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Referer": "https://boardgamegeek.com/",
    "Origin": "https://boardgamegeek.com",
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

    // Normalize encoded parentheses - Geekdo's CDN requires literal ()
    let normalizedTarget = target
      .replace(/%28/gi, "(")
      .replace(/%29/gi, ")")
      .replace(/%2528/gi, "(")
      .replace(/%2529/gi, ")")
      .replace(/&quot;.*$/, "")
      .replace(/;$/, "");

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
});
