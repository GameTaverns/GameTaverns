// AI imports removed — catalog-first policy eliminates AI usage in lookups

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============= Rate Limiting =============
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 10; // Max 10 requests per minute per IP
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

// Difficulty levels from the database enum
const DIFFICULTY_LEVELS = [
  "1 - Light",
  "2 - Medium Light",
  "3 - Medium",
  "4 - Medium Heavy",
  "5 - Heavy",
];

// Play time options from database enum
const PLAY_TIME_OPTIONS = [
  "0-15 Minutes",
  "15-30 Minutes",
  "30-45 Minutes",
  "45-60 Minutes",
  "60+ Minutes",
  "2+ Hours",
  "3+ Hours",
];

// Game type options from database enum
const GAME_TYPE_OPTIONS = [
  "Board Game",
  "Card Game",
  "Dice Game",
  "Party Game",
  "War Game",
  "Miniatures",
  "RPG",
  "Other",
];

type BggLookupResponse = {
  success: boolean;
  data?: {
    bgg_id: string;
    title: string | null;
    description: string | null;
    image_url: string | null;
    min_players: number | null;
    max_players: number | null;
    suggested_age: string | null;
    playing_time_minutes: number | null;
    difficulty: string | null;
    play_time: string | null;
    game_type: string | null;
    mechanics: string[];
    publisher: string | null;
  };
  error?: string;
};

async function safeReadJson(response: Response): Promise<any> {
  const raw = await response.text();
  if (!raw || raw.trim().length === 0) {
    throw new Error(`Empty JSON response (status ${response.status})`);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `Invalid JSON response (status ${response.status}): ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

function extractAttr(xml: string, tag: string, attr: string): string | null {
  const re = new RegExp(`<${tag}[^>]*\\b${attr}="([^"]+)"[^>]*>`, "i");
  const m = xml.match(re);
  return m?.[1] ?? null;
}

function extractTagText(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m?.[1]?.trim() ?? null;
}

function extractPrimaryName(xml: string): string | null {
  const re = /<name[^>]*\btype="primary"[^>]*\bvalue="([^"]+)"[^>]*\/?>(?:<\/name>)?/i;
  const m = xml.match(re);
  return m?.[1] ?? null;
}

function extractMetaContent(html: string, propertyOrName: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)="${propertyOrName}"[^>]+content="([^"]+)"[^>]*>`,
    "i"
  );
  const m = html.match(re);
  return m?.[1]?.trim() ?? null;
}

function pickBestGeekdoImage(html: string): string | null {
  const imageRegex = /https?:\/\/cf\.geekdo-images\.com[^\s"'<>]+/g;
  const all = html.match(imageRegex) || [];
  const unique = [...new Set(all)];

  const filtered = unique.filter((img) => !/crop100|square30|100x100|150x150|_thumb|_avatar|_micro|opengraph/i.test(img));

  filtered.sort((a, b) => {
    const prio = (url: string) => {
      if (/_itemrep/i.test(url)) return 0;
      if (/_imagepage/i.test(url)) return 1;
      if (/_original/i.test(url)) return 2;
      return 3;
    };
    return prio(a) - prio(b);
  });

  return filtered[0] ?? null;
}

// Map playing time to enum
function mapPlayTime(minutes: number | null): string | null {
  if (minutes == null) return null;
  if (minutes <= 15) return "0-15 Minutes";
  if (minutes <= 30) return "15-30 Minutes";
  if (minutes <= 45) return "30-45 Minutes";
  if (minutes <= 60) return "45-60 Minutes";
  if (minutes <= 90) return "60+ Minutes";
  if (minutes <= 180) return "2+ Hours";
  return "3+ Hours";
}

// Export handler for self-hosted router
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting
  const clientIP = getClientIP(req);
  if (!checkRateLimit(clientIP)) {
    console.log(`Rate limit exceeded for IP: ${clientIP.substring(0, 10)}...`);
    return new Response(
      JSON.stringify({ success: false, error: "Rate limit exceeded. Please wait a moment before trying again." } satisfies BggLookupResponse),
      {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      }
    );
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method Not Allowed" } satisfies BggLookupResponse), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => null);
    const urlOrId = body?.url ?? body?.bgg_id;

    if (!urlOrId || typeof urlOrId !== "string") {
      return new Response(JSON.stringify({ success: false, error: "url or bgg_id is required" } satisfies BggLookupResponse), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const idMatch = urlOrId.match(/(?:boardgame\/(\d+))|(\d+)/);
    const bggId = idMatch?.[1] ?? idMatch?.[2];

    if (!bggId) {
      return new Response(JSON.stringify({ success: false, error: "Could not determine BGG id" } satisfies BggLookupResponse), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------------------------------------------------------------
    // CATALOG-FIRST: Check our local game_catalog before hitting any
    // external APIs (BGG XML, Firecrawl, AI). This eliminates AI costs
    // for the ~185k games already in our catalog.
    // ---------------------------------------------------------------
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (supabaseUrl && serviceRoleKey) {
      try {
        const { createClient } = await import("npm:@supabase/supabase-js@2");
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        
        const { data: catalogEntry } = await supabase
          .from("game_catalog")
          .select("id, title, description, image_url, min_players, max_players, play_time_minutes, weight, suggested_age, is_expansion, bgg_community_rating, bgg_url")
          .eq("bgg_id", bggId)
          .maybeSingle();

        if (catalogEntry) {
          console.log(`[bgg-lookup] Catalog hit for BGG ${bggId}: "${catalogEntry.title}"`);
          
          // Fetch mechanics, publishers from catalog
          const [mechanicsRes, publishersRes] = await Promise.all([
            supabase.from("catalog_mechanics").select("mechanic:mechanics(name)").eq("catalog_id", catalogEntry.id),
            supabase.from("catalog_publishers").select("publisher:publishers(name)").eq("catalog_id", catalogEntry.id),
          ]);
          
          const mechanics = (mechanicsRes.data || []).map((r: any) => r.mechanic?.name).filter(Boolean);
          const publisher = (publishersRes.data || [])[0]?.publisher?.name || null;

          // Map weight to difficulty
          let difficulty: string | null = null;
          if (catalogEntry.weight != null) {
            const w = Number(catalogEntry.weight);
            if (w <= 1.5) difficulty = "1 - Light";
            else if (w <= 2.25) difficulty = "2 - Medium Light";
            else if (w <= 3.0) difficulty = "3 - Medium";
            else if (w <= 3.75) difficulty = "4 - Medium Heavy";
            else difficulty = "5 - Heavy";
          }

          return new Response(JSON.stringify({
            success: true,
            data: {
              bgg_id: bggId,
              title: catalogEntry.title,
              description: catalogEntry.description,
              image_url: catalogEntry.image_url,
              min_players: catalogEntry.min_players,
              max_players: catalogEntry.max_players,
              suggested_age: catalogEntry.suggested_age,
              playing_time_minutes: catalogEntry.play_time_minutes,
              difficulty: difficulty || "3 - Medium",
              play_time: mapPlayTime(catalogEntry.play_time_minutes),
              game_type: "Board Game",
              mechanics,
              publisher,
            },
          } satisfies BggLookupResponse), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        console.log(`[bgg-lookup] No catalog entry for BGG ${bggId}, falling back to BGG XML`);
      } catch (e) {
        console.warn(`[bgg-lookup] Catalog lookup failed, falling through to BGG:`, e);
      }
    }

    const pageUrl = `https://boardgamegeek.com/boardgame/${encodeURIComponent(bggId)}`;

    // STEP 1: Try BGG XML API first for canonical box art image AND title
    const bggApiToken = Deno.env.get("BGG_API_TOKEN") || "";
    const bggCookie = Deno.env.get("BGG_SESSION_COOKIE") || Deno.env.get("BGG_COOKIE") || "";
    const bggHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/xml",
    };
    if (bggApiToken) bggHeaders["Authorization"] = `Bearer ${bggApiToken}`;
    if (bggCookie) bggHeaders["Cookie"] = bggCookie;

    let xmlImageUrl: string | null = null;
    let xmlTitle: string | null = null;
    let xmlMinPlayers: number | null = null;
    let xmlMaxPlayers: number | null = null;
    let xmlPlayTime: number | null = null;
    let xmlWeight: number | null = null;
    let xmlAge: string | null = null;
    let xmlDescription: string | null = null;
    let xmlMechanics: string[] = [];
    let xmlPublisher: string | null = null;
    
    try {
      const xmlUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${bggId}&stats=1`;
      let xmlRes = await fetch(xmlUrl, { headers: bggHeaders });

      if (xmlRes.status === 202) {
        console.log(`BGG XML returned 202 for ${bggId}, retrying...`);
        await new Promise(r => setTimeout(r, 2000));
        xmlRes = await fetch(xmlUrl, { headers: bggHeaders });
      }

      if (xmlRes.ok) {
        const xml = await xmlRes.text();
        if (xml.includes("<item")) {
          xmlTitle = extractPrimaryName(xml);
          const imgMatch = xml.match(/<image>([^<]+)<\/image>/);
          if (imgMatch?.[1]) xmlImageUrl = imgMatch[1];
          
          // Extract all metadata from XML
          const minP = xml.match(/<minplayers[^>]*value="(\d+)"/);
          const maxP = xml.match(/<maxplayers[^>]*value="(\d+)"/);
          const playT = xml.match(/<playingtime[^>]*value="(\d+)"/);
          const weightM = xml.match(/<averageweight[^>]*value="([\d.]+)"/);
          const ageM = xml.match(/<minage[^>]*value="(\d+)"/);
          
          if (minP) xmlMinPlayers = parseInt(minP[1], 10);
          if (maxP) xmlMaxPlayers = parseInt(maxP[1], 10);
          if (playT) xmlPlayTime = parseInt(playT[1], 10);
          if (weightM) xmlWeight = parseFloat(weightM[1]);
          if (ageM) xmlAge = `${ageM[1]}+`;
          
          // Description
          const descMatch = xml.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
          if (descMatch?.[1]) {
            xmlDescription = descMatch[1]
              .replace(/&#10;/g, "\n").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
              .trim();
            if (xmlDescription.length > 5000) xmlDescription = xmlDescription.slice(0, 5000);
          }
          
          // Mechanics
          const mechMatches = xml.matchAll(/<link[^>]*type="boardgamemechanic"[^>]*value="([^"]+)"/g);
          xmlMechanics = [...mechMatches].map(m => m[1]);
          
          // Publisher
          const pubMatch = xml.match(/<link[^>]*type="boardgamepublisher"[^>]*value="([^"]+)"/);
          if (pubMatch) xmlPublisher = pubMatch[1];
        }
      }
    } catch (e) {
      console.warn(`BGG XML fetch failed for ${bggId}:`, e);
    }

    // If XML failed, try lightweight HTML fetch
    if (!xmlTitle) {
      try {
        const htmlRes = await fetch(pageUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Accept": "text/html" },
          redirect: "follow",
        });
        if (htmlRes.ok) {
          const html = await htmlRes.text();
          xmlTitle = extractMetaContent(html, "og:title")?.replace(/ \| Board Game.*$/i, "")?.trim() || null;
          if (!xmlImageUrl) xmlImageUrl = pickBestGeekdoImage(html) || extractMetaContent(html, "og:image") || null;
        }
      } catch (e) {
        console.warn(`HTML fallback failed for ${bggId}:`, e);
      }
    }

    // Map weight to difficulty
    let difficulty: string | null = null;
    if (xmlWeight != null && xmlWeight > 0) {
      if (xmlWeight < 1.5) difficulty = "1 - Light";
      else if (xmlWeight < 2.25) difficulty = "2 - Medium Light";
      else if (xmlWeight < 3.0) difficulty = "3 - Medium";
      else if (xmlWeight < 3.75) difficulty = "4 - Medium Heavy";
      else difficulty = "5 - Heavy";
    }

    // Return BGG XML data directly — NO AI, NO Firecrawl
    console.log(`[bgg-lookup] Returning BGG XML data for ${bggId} (no AI)`);
    return new Response(JSON.stringify({
      success: true,
      data: {
        bgg_id: bggId,
        title: xmlTitle,
        description: xmlDescription,
        image_url: xmlImageUrl,
        min_players: xmlMinPlayers,
        max_players: xmlMaxPlayers,
        suggested_age: xmlAge,
        playing_time_minutes: xmlPlayTime,
        difficulty: difficulty || "3 - Medium",
        play_time: mapPlayTime(xmlPlayTime),
        game_type: "Board Game",
        mechanics: xmlMechanics,
        publisher: xmlPublisher,
      },
    } satisfies BggLookupResponse), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("bgg-lookup error", e);
    return new Response(JSON.stringify({ success: false, error: "Lookup failed" } satisfies BggLookupResponse), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// For Lovable Cloud deployment (direct function invocation)
// Guard so this module can be imported by the self-hosted main router.
if (import.meta.main) {
  Deno.serve(handler);
}
