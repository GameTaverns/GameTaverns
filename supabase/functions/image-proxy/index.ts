const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_HOSTS = new Set(["cf.geekdo-images.com"]);

function browserLikeHeaders(targetUrl: string) {
  // BGG CDN requires specific headers to allow access
  return {
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    // BGG requires their domain as referrer
    "Referer": "https://boardgamegeek.com/",
    "Origin": "https://boardgamegeek.com",
    "Host": "cf.geekdo-images.com",
    "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "image",
    "Sec-Fetch-Mode": "no-cors",
    "Sec-Fetch-Site": "cross-site",
    "Connection": "keep-alive",
  } as Record<string, string>;
}

// Try to convert itemrep URLs to original size which may have different CDN rules
function tryAlternativeUrl(url: string): string[] {
  const alternatives = [url];
  
  // Try converting __itemrep to __original (full size, less restricted)
  if (url.includes("__itemrep")) {
    alternatives.push(url.replace("__itemrep", "__original"));
  }
  
  // Try converting to thumb which is typically more available
  if (url.includes("__itemrep")) {
    alternatives.push(url.replace("__itemrep", "__thumb"));
  }
  
  // Try the imagepage format (square crop)
  if (url.includes("__itemrep")) {
    alternatives.push(url.replace(/__itemrep.*?\//, "__imagepage/"));
  }
  
  return alternatives;
}

async function fetchWithRetry(url: string, headers: Record<string, string>): Promise<Response | null> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      redirect: "follow",
    });
    
    if (response.ok && response.body) {
      return response;
    }
  } catch {
    // Ignore and try next
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
      .replace(/%2528/gi, "(")  // Double-encoded
      .replace(/%2529/gi, ")");
    
    // Clean up any HTML entities that might have been scraped incorrectly
    normalizedTarget = normalizedTarget
      .replace(/&quot;.*$/, "")  // Remove &quot; and anything after
      .replace(/;$/, "");        // Remove trailing semicolons

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

    const headers = browserLikeHeaders(normalizedTarget);
    const urlsToTry = tryAlternativeUrl(normalizedTarget);
    
    let successResponse: Response | null = null;
    
    for (const tryUrl of urlsToTry) {
      successResponse = await fetchWithRetry(tryUrl, headers);
      if (successResponse) {
        break;
      }
    }

    if (!successResponse) {
      console.error("image-proxy: all URLs failed for", normalizedTarget);
      // Return a transparent placeholder or redirect to a fallback
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          // Redirect to the original URL - browser might have better luck
          "Location": normalizedTarget,
        },
      });
    }

    const contentType = successResponse.headers.get("content-type") || "image/jpeg";

    return new Response(successResponse.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        // Cache aggressively; images are immutable by URL (1 year)
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    });
  } catch (e) {
    console.error("image-proxy error", e);
    return new Response("Proxy error", { status: 500, headers: corsHeaders });
  }
});
