import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KNOWN_PUBLISHERS: Record<string, { name: string; domain: string; searchPath: string }> = {
  allplay: { name: "Allplay", domain: "www.allplay.com", searchPath: "/board-games/" },
  "czech-games": { name: "Czech Games Edition", domain: "czechgames.com", searchPath: "/games/" },
  stonemaier: { name: "Stonemaier Games", domain: "stonemaiergames.com", searchPath: "/games/" },
  leder: { name: "Leder Games", domain: "ledergames.com", searchPath: "/products/" },
  pandasaurus: { name: "Pandasaurus Games", domain: "pandasaurusgames.com", searchPath: "/products/" },
  "days-of-wonder": { name: "Days of Wonder", domain: "www.daysofwonder.com", searchPath: "/en/games/" },
  "fantasy-flight": { name: "Fantasy Flight Games", domain: "www.fantasyflightgames.com", searchPath: "/en/products/" },
  asmodee: { name: "Asmodee", domain: "www.asmodee.com", searchPath: "/products/" },
  "plan-b": { name: "Plan B Games", domain: "www.planbgames.com", searchPath: "/games/" },
  "renegade": { name: "Renegade Game Studios", domain: "www.renegadegamestudios.com", searchPath: "/game/" },
};

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const sb = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action = "scan", catalog_id, publisher_key, limit = 10 } = body;

    if (action === "scan-single" && catalog_id) {
      // Scan a single game across known publisher sites
      const { data: game } = await sb
        .from("game_catalog")
        .select("id, title, bgg_id")
        .eq("id", catalog_id)
        .single();
      if (!game) {
        return new Response(JSON.stringify({ error: "Game not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results = await scanGameAcrossPublishers(sb, game, firecrawlKey);
      return new Response(JSON.stringify({ success: true, game: game.title, links_found: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "scan-publisher" && publisher_key) {
      // Scan a specific publisher's site for games in our catalog
      const pub = KNOWN_PUBLISHERS[publisher_key];
      if (!pub) {
        return new Response(JSON.stringify({ error: "Unknown publisher", known: Object.keys(KNOWN_PUBLISHERS) }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!firecrawlKey) {
        return new Response(JSON.stringify({ error: "Firecrawl not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results = await scanPublisherSite(sb, pub, firecrawlKey, limit);
      return new Response(JSON.stringify({ success: true, publisher: pub.name, ...results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list-publishers") {
      return new Response(JSON.stringify({ publishers: KNOWN_PUBLISHERS }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      error: "Invalid action",
      valid_actions: ["scan-single", "scan-publisher", "list-publishers"],
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("purchase-link-scanner error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

async function scanGameAcrossPublishers(
  sb: any,
  game: { id: string; title: string; bgg_id: string | null },
  firecrawlKey: string | undefined,
): Promise<number> {
  let totalAdded = 0;
  const titleSlug = slugifyTitle(game.title);
  console.log(`[purchase-link-scanner] Scanning "${game.title}" (slug: ${titleSlug}) across ${Object.keys(KNOWN_PUBLISHERS).length} publishers`);

  for (const [key, pub] of Object.entries(KNOWN_PUBLISHERS)) {
    const candidateUrl = `https://${pub.domain}${pub.searchPath}${titleSlug}`;

    try {
      // Use GET instead of HEAD — many sites block HEAD or return misleading status codes
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(candidateUrl, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "GameTaverns/1.0 LinkScanner" },
      });
      clearTimeout(timeout);

      const finalUrl = res.url; // After redirects
      const status = res.status;
      // Consume body to prevent resource leak
      const body = await res.text();

      // Check for soft 404s: page exists (200) but contains "not found" / "page not found" signals
      const isSoft404 = body.length < 1000 ||
        /page\s*not\s*found|404|no\s*results|doesn.t\s*exist/i.test(body.substring(0, 2000));

      console.log(`[purchase-link-scanner] ${key}: ${candidateUrl} → ${status} (body: ${body.length} chars, soft404: ${isSoft404}, final: ${finalUrl})`);

      if (res.ok && !isSoft404) {
        const { error } = await sb.from("catalog_purchase_links").upsert(
          {
            catalog_id: game.id,
            retailer_name: pub.name,
            url: finalUrl || candidateUrl,
            source: "auto_scan",
            status: "approved",
          },
          { onConflict: "catalog_id,url" }
        );
        if (!error) {
          totalAdded++;
          console.log(`[purchase-link-scanner] ✅ Added ${pub.name} link for "${game.title}"`);
        } else {
          console.log(`[purchase-link-scanner] DB error for ${pub.name}:`, error.message);
        }
      }
    } catch (_e) {
      console.log(`[purchase-link-scanner] ${key}: ${candidateUrl} → failed (${(_e as Error).message})`);
    }
  }

  console.log(`[purchase-link-scanner] Scan complete for "${game.title}": ${totalAdded} links found`);
  return totalAdded;
}

async function scanPublisherSite(
  sb: any,
  pub: { name: string; domain: string; searchPath: string },
  firecrawlKey: string,
  limit: number,
): Promise<{ urls_found: number; matched: number; links_added: number }> {
  // Use Firecrawl to map the publisher's game pages
  const mapRes = await fetch("https://api.firecrawl.dev/v1/map", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${firecrawlKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: `https://${pub.domain}${pub.searchPath}`,
      limit: Math.min(limit * 10, 5000),
      includeSubdomains: false,
    }),
  });

  const mapData = await mapRes.json();
  if (!mapData.success && !mapData.links) {
    return { urls_found: 0, matched: 0, links_added: 0 };
  }

  const urls: string[] = (mapData.links || []).filter((url: string) =>
    url.includes(pub.searchPath) && !url.endsWith(pub.searchPath)
  );

  // Extract game slugs from URLs
  const urlGameSlugs = urls.map((url: string) => {
    const parts = url.replace(`https://${pub.domain}${pub.searchPath}`, "").split("/").filter(Boolean);
    return parts[0] || "";
  }).filter(Boolean);

  // Try to match against our catalog by slugified titles
  const { data: catalogGames } = await sb
    .from("game_catalog")
    .select("id, title, slug")
    .limit(10000);

  let matched = 0;
  let linksAdded = 0;

  if (catalogGames) {
    for (const cg of catalogGames) {
      const cgSlug = slugifyTitle(cg.title);
      const matchIdx = urlGameSlugs.findIndex((s: string) => s === cgSlug || s === cg.slug);
      if (matchIdx !== -1) {
        matched++;
        const matchedUrl = urls[matchIdx];
        const { error } = await sb.from("catalog_purchase_links").upsert(
          {
            catalog_id: cg.id,
            retailer_name: pub.name,
            url: matchedUrl,
            source: "auto_scan",
            status: "approved",
          },
          { onConflict: "catalog_id,url" }
        );
        if (!error) linksAdded++;

        if (linksAdded >= limit) break;
      }
    }
  }

  return { urls_found: urls.length, matched, links_added: linksAdded };
}

export default handler;
if (import.meta.main) {
  Deno.serve(handler);
}
