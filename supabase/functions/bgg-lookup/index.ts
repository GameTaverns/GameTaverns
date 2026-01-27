import { aiComplete, isAIConfigured, getAIProviderName } from "../_shared/ai-client.ts";

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

Deno.serve(async (req) => {
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
    const useAI = body?.use_ai !== false; // Default to using AI

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

    const pageUrl = `https://boardgamegeek.com/boardgame/${encodeURIComponent(bggId)}`;

    // Always use Firecrawl for consistent results (BGG XML API is often blocked)
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      console.error("Firecrawl API key not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Import service temporarily unavailable" } satisfies BggLookupResponse),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Scraping BGG page with Firecrawl:", pageUrl);

    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: pageUrl,
        formats: ["markdown", "rawHtml"],
        onlyMainContent: true,
      }),
    });

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      console.error("Firecrawl error:", scrapeResponse.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to scrape page: ${scrapeResponse.status}` } satisfies BggLookupResponse),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const scrapeData = await scrapeResponse.json();
    const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
    const rawHtml = scrapeData.data?.rawHtml || scrapeData.rawHtml || "";

    // Get basic info from HTML
    const title =
      extractMetaContent(rawHtml, "og:title") ||
      extractMetaContent(rawHtml, "twitter:title") ||
      null;

    const imageUrl =
      pickBestGeekdoImage(rawHtml) ||
      extractMetaContent(rawHtml, "og:image") ||
      extractMetaContent(rawHtml, "twitter:image");

    // If AI is disabled or not available, return basic data
    if (!useAI || !isAIConfigured()) {
      console.log("Returning basic data (AI disabled or unavailable)");
      return new Response(JSON.stringify({
        success: true,
        data: {
          bgg_id: bggId,
          title,
          description: null,
          image_url: imageUrl,
          min_players: null,
          max_players: null,
          suggested_age: null,
          playing_time_minutes: null,
          difficulty: "3 - Medium",
          play_time: "45-60 Minutes",
          game_type: "Board Game",
          mechanics: [],
          publisher: null,
        },
      } satisfies BggLookupResponse), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use AI to extract structured game data
    console.log(`Extracting game data with AI (${getAIProviderName()})...`);
    const aiResult = await aiComplete({
      messages: [
          {
            role: "system",
            content: `You are a board game data extraction expert. Extract detailed, structured game information from the provided content.

IMPORTANT RULES:

1. For enum fields, you MUST use these EXACT values:
   - difficulty: ${DIFFICULTY_LEVELS.map(d => `"${d}"`).join(", ")}
   - play_time: ${PLAY_TIME_OPTIONS.map(p => `"${p}"`).join(", ")}
   - game_type: ${GAME_TYPE_OPTIONS.map(t => `"${t}"`).join(", ")}

2. For the DESCRIPTION field, create a COMPREHENSIVE, DETAILED description that includes:
   - An engaging overview paragraph about the game
   - A "## Quick Gameplay Overview" section with:
     - **Goal:** What players are trying to achieve
     - **On Your Turn:** The main actions players can take (use numbered lists)
     - **Scoring:** How points are earned
     - **End Game:** When and how the game ends
   - A closing paragraph about the game's appeal/experience
   
   Use markdown formatting with headers (##), bold (**text**), and bullet points.
   Make it detailed and informative - aim for 300-500 words.

3. For mechanics, extract actual game mechanics (e.g., "Worker Placement", "Set Collection", "Dice Rolling").

4. For publisher, extract the publisher company name.`,
          },
          {
            role: "user",
            content: `Extract comprehensive board game data from this BoardGameGeek page.

TARGET PAGE: ${pageUrl}

MAIN IMAGE URL (use this): ${imageUrl || "No image found"}

Page content:
${markdown.slice(0, 18000)}`,
          },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_game_data",
            description: "Extract structured game data from page content",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "The game title" },
                description: { 
                  type: "string", 
                  description: "Comprehensive game description with markdown formatting. Include overview, Quick Gameplay Overview section with Goal/Turn Actions/Scoring/End Game, and closing appeal paragraph. Aim for 300-500 words." 
                },
                difficulty: { 
                  type: "string", 
                  enum: DIFFICULTY_LEVELS,
                  description: "Difficulty level" 
                },
                play_time: { 
                  type: "string", 
                  enum: PLAY_TIME_OPTIONS,
                  description: "Play time category" 
                },
                game_type: { 
                  type: "string", 
                  enum: GAME_TYPE_OPTIONS,
                  description: "Type of game" 
                },
                min_players: { type: "number", description: "Minimum player count" },
                max_players: { type: "number", description: "Maximum player count" },
                suggested_age: { type: "string", description: "Suggested age (e.g., '10+')" },
                mechanics: { 
                  type: "array", 
                  items: { type: "string" },
                  description: "Game mechanics like Worker Placement, Set Collection, etc." 
                },
                publisher: { type: "string", description: "Publisher name" },
              },
              required: ["title"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_game_data" } },
    });

    if (!aiResult.success) {
      console.error("AI extraction error:", aiResult.error);
      
      // Handle rate limits
      if (aiResult.rateLimited) {
        return new Response(
          JSON.stringify({ success: false, error: "Service temporarily busy. Please try again in a moment." } satisfies BggLookupResponse),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Fall back to basic data on AI error
      return new Response(JSON.stringify({
        success: true,
        data: {
          bgg_id: bggId,
          title,
          description: null,
          image_url: imageUrl,
          min_players: null,
          max_players: null,
          suggested_age: null,
          playing_time_minutes: null,
          difficulty: "3 - Medium",
          play_time: "45-60 Minutes",
          game_type: "Board Game",
          mechanics: [],
          publisher: null,
        },
      } satisfies BggLookupResponse), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract the tool call result
    const extractedData = aiResult.toolCallArguments;
    if (!extractedData) {
      console.error("No tool call result from AI");
      return new Response(JSON.stringify({
        success: true,
        data: {
          bgg_id: bggId,
          title,
          description: null,
          image_url: imageUrl,
          min_players: null,
          max_players: null,
          suggested_age: null,
          playing_time_minutes: null,
          difficulty: "3 - Medium",
          play_time: "45-60 Minutes",
          game_type: "Board Game",
          mechanics: [],
          publisher: null,
        },
      } satisfies BggLookupResponse), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Extracted data:", JSON.stringify(extractedData, null, 2));

    // Type assertion for extracted data
    const data = extractedData as {
      title?: string;
      description?: string;
      difficulty?: string;
      play_time?: string;
      game_type?: string;
      min_players?: number;
      max_players?: number;
      suggested_age?: string;
      mechanics?: string[];
      publisher?: string;
    };

    // Map play_time to playing_time_minutes for compatibility
    let playingTimeMinutes: number | null = null;
    if (data.play_time) {
      const timeMap: Record<string, number> = {
        "0-15 Minutes": 10,
        "15-30 Minutes": 22,
        "30-45 Minutes": 37,
        "45-60 Minutes": 52,
        "60+ Minutes": 75,
        "2+ Hours": 150,
        "3+ Hours": 210,
      };
      playingTimeMinutes = timeMap[data.play_time] ?? null;
    }

    const resp: BggLookupResponse = {
      success: true,
      data: {
        bgg_id: bggId,
        title: data.title || title,
        description: data.description || null,
        image_url: imageUrl,
        min_players: typeof data.min_players === "number" ? data.min_players : null,
        max_players: typeof data.max_players === "number" ? data.max_players : null,
        suggested_age: data.suggested_age || null,
        playing_time_minutes: playingTimeMinutes,
        difficulty: data.difficulty || "3 - Medium",
        play_time: data.play_time || "45-60 Minutes",
        game_type: data.game_type || "Board Game",
        mechanics: Array.isArray(data.mechanics) ? data.mechanics : [],
        publisher: data.publisher || null,
      },
    };

    return new Response(JSON.stringify(resp), {
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
});
