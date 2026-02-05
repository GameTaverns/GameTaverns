import { createClient } from "npm:@supabase/supabase-js@2";
import { aiComplete, isAIConfigured, getAIProviderName } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Enum compatibility
// ---------------------------------------------------------------------------
// Cloud + app UI historically used one enum set ("1 - Light", "Miniatures", "0-15 Minutes", ...)
// Self-hosted schema (deploy/* migrations) uses a different enum set.
// Detect the environment by SUPABASE_URL and normalize inputs accordingly.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const IS_SELF_HOSTED =
  SUPABASE_URL.startsWith("http://") ||
  SUPABASE_URL.includes("kong") ||
  SUPABASE_URL.includes("localhost") ||
  SUPABASE_URL.includes("127.0.0.1");

const CLOUD_DIFFICULTY_LEVELS = [
  "1 - Light",
  "2 - Medium Light",
  "3 - Medium",
  "4 - Medium Heavy",
  "5 - Heavy",
] as const;

const SELF_HOSTED_DIFFICULTY_LEVELS = [
  "1 - Very Easy",
  "2 - Easy",
  "3 - Medium",
  "4 - Hard",
  "5 - Very Hard",
] as const;

const CLOUD_PLAY_TIME_OPTIONS = [
  "0-15 Minutes",
  "15-30 Minutes",
  "30-45 Minutes",
  "45-60 Minutes",
  "60+ Minutes",
  "2+ Hours",
  "3+ Hours",
] as const;

const SELF_HOSTED_PLAY_TIME_OPTIONS = [
  "Under 30 Minutes",
  "30-45 Minutes",
  "45-60 Minutes",
  "60-90 Minutes",
  "90-120 Minutes",
  "2-3 Hours",
  "3+ Hours",
] as const;

const CLOUD_GAME_TYPE_OPTIONS = [
  "Board Game",
  "Card Game",
  "Dice Game",
  "Party Game",
  "War Game",
  "Miniatures",
  "RPG",
  "Other",
] as const;

const SELF_HOSTED_GAME_TYPE_OPTIONS = [
  "Board Game",
  "Card Game",
  "Dice Game",
  "Party Game",
  "Strategy Game",
  "Cooperative Game",
  "Miniatures Game",
  "Role-Playing Game",
  "Deck Building",
  "Area Control",
  "Worker Placement",
  "Other",
] as const;

// Active enum sets for validation + AI prompting
const DIFFICULTY_LEVELS = (IS_SELF_HOSTED ? SELF_HOSTED_DIFFICULTY_LEVELS : CLOUD_DIFFICULTY_LEVELS) as readonly string[];
const PLAY_TIME_OPTIONS = (IS_SELF_HOSTED ? SELF_HOSTED_PLAY_TIME_OPTIONS : CLOUD_PLAY_TIME_OPTIONS) as readonly string[];
const GAME_TYPE_OPTIONS = (IS_SELF_HOSTED ? SELF_HOSTED_GAME_TYPE_OPTIONS : CLOUD_GAME_TYPE_OPTIONS) as readonly string[];

const normalizeEnum = (value: string | undefined, allowed: readonly string[]): string | undefined => {
  if (!value) return undefined;
  const v = value.trim();
  return allowed.includes(v) ? v : undefined;
};

const normalizeDifficulty = (difficulty: string | undefined): string | undefined => {
  if (!difficulty) return undefined;

  const d = difficulty.trim();

  // If it's already valid for this environment, keep it.
  const direct = normalizeEnum(d, DIFFICULTY_LEVELS);
  if (direct) return direct;

  // Cross-map between Cloud and Self-hosted vocab.
  const cloudToSelf: Record<string, string> = {
    "1 - Light": "1 - Very Easy",
    "2 - Medium Light": "2 - Easy",
    "3 - Medium": "3 - Medium",
    "4 - Medium Heavy": "4 - Hard",
    "5 - Heavy": "5 - Very Hard",
  };
  const selfToCloud: Record<string, string> = {
    "1 - Very Easy": "1 - Light",
    "2 - Easy": "2 - Medium Light",
    "3 - Medium": "3 - Medium",
    "4 - Hard": "4 - Medium Heavy",
    "5 - Very Hard": "5 - Heavy",
  };

  const mapped = IS_SELF_HOSTED ? cloudToSelf[d] : selfToCloud[d];
  return normalizeEnum(mapped, DIFFICULTY_LEVELS);
};

const normalizePlayTime = (playTime: string | undefined): string | undefined => {
  if (!playTime) return undefined;

  const p = playTime.trim();
  const direct = normalizeEnum(p, PLAY_TIME_OPTIONS);
  if (direct) return direct;

  const cloudToSelf: Record<string, string> = {
    "0-15 Minutes": "Under 30 Minutes",
    "15-30 Minutes": "Under 30 Minutes",
    "30-45 Minutes": "30-45 Minutes",
    "45-60 Minutes": "45-60 Minutes",
    "60+ Minutes": "60-90 Minutes",
    "2+ Hours": "2-3 Hours",
    "3+ Hours": "3+ Hours",
  };
  const selfToCloud: Record<string, string> = {
    "Under 30 Minutes": "15-30 Minutes",
    "30-45 Minutes": "30-45 Minutes",
    "45-60 Minutes": "45-60 Minutes",
    "60-90 Minutes": "60+ Minutes",
    "90-120 Minutes": "2+ Hours",
    "2-3 Hours": "2+ Hours",
    "3+ Hours": "3+ Hours",
  };

  const mapped = IS_SELF_HOSTED ? cloudToSelf[p] : selfToCloud[p];
  return normalizeEnum(mapped, PLAY_TIME_OPTIONS);
};

const normalizeGameType = (gameType: string | undefined): string | undefined => {
  if (!gameType) return undefined;
  const t = gameType.trim();

  const direct = normalizeEnum(t, GAME_TYPE_OPTIONS);
  if (direct) return direct;

  const cloudToSelf: Record<string, string> = {
    "Miniatures": "Miniatures Game",
    "RPG": "Role-Playing Game",
    "War Game": "Strategy Game",
  };
  const selfToCloud: Record<string, string> = {
    "Miniatures Game": "Miniatures",
    "Role-Playing Game": "RPG",
    "Strategy Game": "Other",
    "Cooperative Game": "Other",
    "Deck Building": "Other",
    "Area Control": "Other",
    "Worker Placement": "Other",
  };

  const mapped = IS_SELF_HOSTED ? cloudToSelf[t] : selfToCloud[t];
  return normalizeEnum(mapped, GAME_TYPE_OPTIONS);
};

const normalizeSaleCondition = (saleCondition: string | undefined): string | undefined => {
  if (!saleCondition) return undefined;
  const c = saleCondition.trim();
  if (!IS_SELF_HOSTED) return c;

  // self-hosted enum uses "New" (not "New/Sealed")
  if (c === "New/Sealed") return "New";
  return c;
};

type ImportMode = "csv" | "bgg_collection" | "bgg_links";

type BulkImportRequest = {
  mode: ImportMode;
  library_id?: string;
  csv_data?: string;
  bgg_username?: string;
  bgg_links?: string[];
  enhance_with_bgg?: boolean;      // Use fast BGG XML API for images/basic data (default: true)
  enhance_with_ai?: boolean;       // Use slow Firecrawl+AI for rich descriptions (default: false)
  default_options?: {
    is_coming_soon?: boolean;
    is_for_sale?: boolean;
    sale_price?: number;
    sale_condition?: string;
    location_room?: string;
    location_shelf?: string;
    location_misc?: string;
    sleeved?: boolean;
    upgraded_components?: boolean;
    crowdfunded?: boolean;
    inserts?: boolean;
  };
};

type FailureBreakdown = {
  already_exists: number;
  missing_title: number;
  create_failed: number;
  exception: number;
};

// Parse CSV data - handles multi-line quoted fields properly
function parseCSV(csvData: string): Record<string, string>[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  
  for (let i = 0; i < csvData.length; i++) {
    const char = csvData[i];
    const nextChar = csvData[i + 1];
    
    if (char === '"') {
      if (!inQuotes) {
        inQuotes = true;
      } else if (nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      if (char === '\r') i++;
      currentRow.push(currentField.trim());
      if (currentRow.some(field => field !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else if (char === '\r' && !inQuotes) {
      currentRow.push(currentField.trim());
      if (currentRow.some(field => field !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }
  
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(field => field !== "")) {
      rows.push(currentRow);
    }
  }
  
  if (rows.length < 2) return [];
  
  const headers = rows[0].map(h => h.toLowerCase().trim());
  
  const result: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });
    result.push(row);
  }
  
  return result;
}

// Lookup BGG data for a game title
async function lookupBGGByTitle(
  title: string,
  firecrawlKey: string
): Promise<{
  bgg_id?: string;
  description?: string;
  image_url?: string;
  min_players?: number;
  max_players?: number;
  suggested_age?: string;
  play_time?: string;
  difficulty?: string;
  game_type?: string;
  mechanics?: string[];
  publisher?: string;
} | null> {
  try {
    // BGG now requires authentication
    const bggApiToken = Deno.env.get("BGG_API_TOKEN");
    const headers: Record<string, string> = {
      "User-Agent": "GameTaverns/1.0 (Bulk Import)",
    };
    if (bggApiToken) {
      headers["Authorization"] = `Bearer ${bggApiToken}`;
    }

    const searchUrl = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(title)}&type=boardgame&exact=1`;
    const searchRes = await fetch(searchUrl, { headers });
    
    if (!searchRes.ok) {
      const fuzzyUrl = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(title)}&type=boardgame`;
      const fuzzyRes = await fetch(fuzzyUrl, { headers });
      if (!fuzzyRes.ok) return null;
      
      const xml = await fuzzyRes.text();
      const idMatch = xml.match(/<item[^>]*id="(\d+)"/);
      if (!idMatch) return null;
      
      return await fetchBGGData(idMatch[1], firecrawlKey);
    }
    
    const xml = await searchRes.text();
    const idMatch = xml.match(/<item[^>]*id="(\d+)"/);
    if (!idMatch) return null;
    
    return await fetchBGGData(idMatch[1], firecrawlKey);
  } catch (e) {
    console.error("BGG lookup error:", e);
    return null;
  }
}

// Helper: sleep for ms
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Concurrency limiter for parallel operations
async function parallelLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];
  
  for (const item of items) {
    const p = fn(item).then((result) => {
      results.push(result);
    });
    executing.push(p);
    
    if (executing.length >= limit) {
      await Promise.race(executing);
      // Remove completed promises
      executing.splice(0, executing.findIndex(() => true) + 1);
    }
  }
  
  await Promise.all(executing);
  return results;
}

// Fetch basic game data from BGG XML API (PRIMARY fast method)
async function fetchBGGXMLData(bggId: string): Promise<{
  bgg_id: string;
  description?: string;
  image_url?: string;
  min_players?: number;
  max_players?: number;
  suggested_age?: string;
  play_time?: string;
  difficulty?: string;
  mechanics?: string[];
  publisher?: string;
  is_expansion?: boolean;
} | null> {
  const xmlUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${bggId}&stats=1`;

  // BGG XML API frequently returns HTTP 202 (Accepted) for heavy traffic.
  // In that case, you must retry the same request after a short delay.
  const maxAttempts = 6;

  // BGG now requires authentication - use BGG_API_TOKEN if available
  const bggApiToken = Deno.env.get("BGG_API_TOKEN");
  const headers: Record<string, string> = {
    "User-Agent": "GameTaverns/1.0 (Bulk Import)",
  };
  if (bggApiToken) {
    headers["Authorization"] = `Bearer ${bggApiToken}`;
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(xmlUrl, { headers });

      // If not ok, return minimal info but don't fail the import.
      if (!res.ok) {
        console.warn(`[BulkImport] BGG XML API returned ${res.status} for ${bggId}${!bggApiToken ? " (no BGG_API_TOKEN configured)" : ""}`);

        // Treat 202 as retryable even if considered "ok" by some proxies.
        if (res.status === 202 && attempt < maxAttempts) {
          const backoffMs = Math.min(750 * attempt, 4000);
          await sleep(backoffMs);
          continue;
        }

        return { bgg_id: bggId };
      }

      const xml = await res.text();

      // Retry conditions:
      // - BGG 202 response body typically contains a <message> asking to retry
      // - Some intermediate caches may return HTML or otherwise incomplete XML
      const retryable =
        xml.includes("Please try again later") ||
        xml.includes("Your request has been accepted") ||
        xml.includes("<message>") ||
        !xml.includes("<item");

      if (retryable && attempt < maxAttempts) {
        const backoffMs = Math.min(750 * attempt, 4000);
        console.log(`[BulkImport] BGG XML not ready for ${bggId}, retrying (${attempt}/${maxAttempts}) in ${backoffMs}ms`);
        await sleep(backoffMs);
        continue;
      }

      // Extract data using regex (simple parsing for XML)
      const imageMatch = xml.match(/<image>([^<]+)<\/image>/);

      // Description can be huge; it may be empty, or in rare cases the tag can be self-closing.
      // We parse a few variants defensively.
      const descMatch =
        xml.match(/<description[^>]*>([\s\S]*?)<\/description>/i) ||
        xml.match(/<description\s*\/>/i);

      const minPlayersMatch = xml.match(/<minplayers[^>]*value="(\d+)"/);
      const maxPlayersMatch = xml.match(/<maxplayers[^>]*value="(\d+)"/);
      const minAgeMatch = xml.match(/<minage[^>]*value="(\d+)"/);
      const playTimeMatch = xml.match(/<playingtime[^>]*value="(\d+)"/);
      const weightMatch = xml.match(/<averageweight[^>]*value="([\d.]+)"/);
      
      // Detect expansion from item type attribute
      const typeMatch = xml.match(/<item[^>]*type="([^"]+)"/);
      const isExpansion = typeMatch?.[1] === "boardgameexpansion";

      // Extract mechanics
      const mechanicsMatches = xml.matchAll(/<link[^>]*type="boardgamemechanic"[^>]*value="([^"]+)"/g);
      const mechanics = [...mechanicsMatches].map((m) => m[1]);

      // Extract publisher (first one)
      const publisherMatch = xml.match(/<link[^>]*type="boardgamepublisher"[^>]*value="([^"]+)"/);

      // Map weight to difficulty
      let difficulty: string | undefined;
      if (weightMatch) {
        const w = parseFloat(weightMatch[1]);
        if (w > 0) {
          if (w < 1.5) difficulty = "1 - Light";
          else if (w < 2.25) difficulty = "2 - Medium Light";
          else if (w < 3.0) difficulty = "3 - Medium";
          else if (w < 3.75) difficulty = "4 - Medium Heavy";
          else difficulty = "5 - Heavy";
        }
      }

      // Map play time to enum
      let play_time: string | undefined;
      if (playTimeMatch) {
        const minutes = parseInt(playTimeMatch[1], 10);
        if (minutes <= 15) play_time = "0-15 Minutes";
        else if (minutes <= 30) play_time = "15-30 Minutes";
        else if (minutes <= 45) play_time = "30-45 Minutes";
        else if (minutes <= 60) play_time = "45-60 Minutes";
        else if (minutes <= 120) play_time = "60+ Minutes";
        else if (minutes <= 180) play_time = "2+ Hours";
        else play_time = "3+ Hours";
      }

      // Decode HTML entities in description.
      // We keep this lightweight but robust enough for common BGG entity patterns.
      const decodeEntities = (input: string) =>
        input
          .replace(/&#10;/g, "\n")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&#(\d+);/g, (_m, code) => {
            const n = Number(code);
            return Number.isFinite(n) ? String.fromCharCode(n) : _m;
          });

      let description: string | undefined;
      if (descMatch && descMatch[1]) {
        description = decodeEntities(descMatch[1]).trim();
        // Increased limit from 2000 to 5000 to match game-import function
        if (description.length > 5000) description = description.slice(0, 5000);
      }

      console.log(`[BulkImport] BGG XML extracted data for ${bggId} (desc=${description?.length || 0} chars, expansion=${isExpansion})`);

      return {
        bgg_id: bggId,
        image_url: imageMatch?.[1],
        description,
        min_players: minPlayersMatch ? parseInt(minPlayersMatch[1], 10) : undefined,
        max_players: maxPlayersMatch ? parseInt(maxPlayersMatch[1], 10) : undefined,
        suggested_age: minAgeMatch ? `${minAgeMatch[1]}+` : undefined,
        play_time,
        difficulty,
        mechanics: mechanics.length > 0 ? mechanics : undefined,
        publisher: publisherMatch?.[1],
        is_expansion: isExpansion,
      };
    } catch (e) {
      console.error("[BulkImport] BGG XML error:", e);
      if (attempt < maxAttempts) {
        const backoffMs = Math.min(750 * attempt, 4000);
        await sleep(backoffMs);
        continue;
      }
      return { bgg_id: bggId };
    }
  }

  return { bgg_id: bggId };
}

// Format a BGG description into structured markdown using AI
// Uses response_format instead of tool calling (Perplexity doesn't support tools)
async function formatDescriptionWithAI(rawContent: string, bggId: string): Promise<string | null> {
  if (!isAIConfigured()) {
    console.log(`[BulkImport] AI not configured, skipping description formatting for ${bggId}`);
    return null;
  }

  try {
    const systemPrompt = `You are a board game description writer. Transform the provided game page content into a well-structured, engaging description.

FORMAT YOUR RESPONSE AS A JSON OBJECT with a single "description" field containing markdown text.

The description should follow this EXACT structure:
1. Opening paragraph (2-3 sentences): What the game is about, theme, player count range
2. "## Quick Gameplay Overview" header
3. Bullet points with bold labels:
   - **Goal:** One sentence about how to win
   - **Each Round:** or **Gameplay:** 3-5 bullet points describing the main actions
   - **End Game:** or **Winner:** One sentence about game end condition

TOTAL: 150-250 words. Keep it scannable and engaging. Use markdown formatting.

Example format:
{
  "description": "Game Name transports 1-4 players to... This game blends strategic X, Y, and Z for an engaging experience.\\n\\n## Quick Gameplay Overview\\n\\n**Goal:** Earn the most points by...\\n\\n**Each Round:**\\n- **Action 1:** Do something\\n- **Action 2:** Do another thing\\n- **Scoring:** Calculate points\\n\\n**Winner:** The player with the most points after X rounds wins."
}`;

    const result = await aiComplete({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Create a structured description for this board game:\n\n${rawContent}` },
      ],
      max_tokens: 800,
      tools: [
        {
          type: "function",
          function: {
            name: "format_description",
            description: "Return the formatted game description",
            parameters: {
              type: "object",
              properties: {
                description: {
                  type: "string",
                  description: "The formatted markdown description following the specified structure",
                },
              },
              required: ["description"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "format_description" } },
    });

    if (!result.success) {
      console.warn(`[BulkImport] AI description formatting failed for ${bggId}:`, result.error);
      return null;
    }

    // Handle both tool call and direct content responses
    if (result.toolCallArguments?.description) {
      return result.toolCallArguments.description as string;
    }
    
    // Try to parse content as JSON if it's a direct response
    if (result.content) {
      try {
        const parsed = JSON.parse(result.content);
        if (parsed.description) {
          return parsed.description;
        }
      } catch {
        // Content might be the description itself
        if (result.content.includes("## Quick Gameplay Overview") || result.content.length > 100) {
          return result.content;
        }
      }
    }

    console.warn(`[BulkImport] AI returned unexpected format for ${bggId}`);
    return null;
  } catch (e) {
    console.error(`[BulkImport] AI description error for ${bggId}:`, e);
    return null;
  }
}

// Fetch full BGG data using Firecrawl + AI with retry logic
async function fetchBGGData(
  bggId: string,
  firecrawlKey: string,
  maxRetries = 3
): Promise<{
  bgg_id: string;
  description?: string;
  image_url?: string;
  min_players?: number;
  max_players?: number;
  suggested_age?: string;
  play_time?: string;
  difficulty?: string;
  game_type?: string;
  mechanics?: string[];
  publisher?: string;
} | null> {
  const pageUrl = `https://boardgamegeek.com/boardgame/${bggId}`;
  
  // Try Firecrawl with retries
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Add delay between retries (exponential backoff)
      if (attempt > 1) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        console.log(`[BulkImport] Retry ${attempt}/${maxRetries} for ${bggId} after ${delayMs}ms`);
        await sleep(delayMs);
      }
      
      const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
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
      
      if (!scrapeRes.ok) {
        console.warn(`[BulkImport] Firecrawl returned ${scrapeRes.status} for ${pageUrl} (attempt ${attempt})`);
        if (scrapeRes.status === 429) {
          // Rate limited - wait longer
          await sleep(5000);
        }
        continue;
      }

      // Defensive JSON parsing
      let scrapeData: any;
      const raw = await scrapeRes.text();
      if (!raw || raw.trim().length === 0) {
        console.warn(`[BulkImport] Firecrawl returned empty body for ${pageUrl} (attempt ${attempt})`);
        continue;
      }
      
      try {
        scrapeData = JSON.parse(raw);
      } catch (e) {
        console.warn(`[BulkImport] Firecrawl returned invalid JSON for ${pageUrl} (attempt ${attempt})`);
        continue;
      }
      
      const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
      const rawHtml = scrapeData.data?.rawHtml || scrapeData.rawHtml || "";
      
      // If we got empty content, retry
      if (!markdown && !rawHtml) {
        console.warn(`[BulkImport] Firecrawl returned empty content for ${pageUrl} (attempt ${attempt})`);
        continue;
      }

      const imageRegex = /https?:\/\/cf\.geekdo-images\.com[^\s"'<>]+/g;
      const images = rawHtml.match(imageRegex) || [];
      const uniqueImages = [...new Set(images)] as string[];
      const filtered = uniqueImages.filter((img: string) => 
        !/crop100|square30|100x100|150x150|_thumb|_avatar|_micro/i.test(img)
      );
      filtered.sort((a: string, b: string) => {
        const prio = (url: string) => {
          if (/_itemrep/i.test(url)) return 0;
          if (/_imagepage/i.test(url)) return 1;
          return 2;
        };
        return prio(a) - prio(b);
      });
      const mainImage: string | null = filtered[0] || null;
      
      // We have an image from Firecrawl; now try to get enriched description from AI
      // if markdown content is available
      if (markdown && markdown.length > 200) {
        console.log(`[BulkImport] Attempting AI description formatting for ${bggId}`);
        const aiDescription = await formatDescriptionWithAI(markdown.slice(0, 10000), bggId);
        if (aiDescription) {
          console.log(`[BulkImport] AI formatted description for ${bggId}: ${aiDescription.length} chars`);
          // Get additional data from BGG XML for player counts, etc.
          const xmlData = await fetchBGGXMLData(bggId);
          return {
            ...xmlData,
            bgg_id: bggId,
            image_url: mainImage ?? xmlData?.image_url,
            description: aiDescription,
          };
        }
      }
      
      // AI formatting failed or no content - fall back to BGG XML
      console.log(`[BulkImport] Firecrawl got image for ${bggId}, using BGG XML for other data`);
      const xmlData = await fetchBGGXMLData(bggId);
      return {
        ...xmlData,
        bgg_id: bggId,
        image_url: mainImage ?? xmlData?.image_url,
      };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn(`[BulkImport] Firecrawl attempt ${attempt} failed for ${bggId}:`, e);
    }
  }
  
  // All Firecrawl retries failed - fallback to BGG XML API
  console.log(`[BulkImport] Firecrawl failed after ${maxRetries} attempts, using BGG XML fallback for ${bggId}`);
  return await fetchBGGXMLData(bggId);
}

// Fetch BGG collection for a user
async function fetchBGGCollection(username: string): Promise<{ id: string; name: string }[]> {
  const collectionUrl = `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(username)}&own=1&excludesubtype=boardgameexpansion`;
  
  // BGG now requires an API token for access
  const bggToken = Deno.env.get("BGG_API_TOKEN");
  
  const headers: Record<string, string> = {
    "User-Agent": "GameTaverns/1.0 (Collection Import)",
    "Accept": "application/xml",
  };
  
  // Add authorization if token is configured
  if (bggToken) {
    headers["Authorization"] = `Bearer ${bggToken}`;
  }
  
  let attempts = 0;
  while (attempts < 5) {
    const res = await fetch(collectionUrl, { headers });
    
    if (res.status === 202) {
      // BGG is processing the request, wait and retry
      await new Promise(r => setTimeout(r, 3000));
      attempts++;
      continue;
    }
    
    if (res.status === 401) {
      // BGG now requires API registration and tokens
      throw new Error(
        "BGG API requires authentication. As an alternative, please export your collection as CSV from BoardGameGeek (Collection → Export) and use the CSV import option instead."
      );
    }
    
    if (res.status === 404 || res.status === 400) {
      throw new Error(`BGG username "${username}" not found or collection is private. Please check the username is correct and your collection is public.`);
    }
    
    if (!res.ok) {
      throw new Error(`Failed to fetch BGG collection (status ${res.status}). Please try again or use CSV import.`);
    }
    
    const xml = await res.text();
    
    // Check for error messages in the response
    if (xml.includes("<error>") || xml.includes("Invalid username")) {
      throw new Error(`BGG username "${username}" not found. Please check the username is correct.`);
    }
    
    const games: { id: string; name: string }[] = [];
    
    const itemRegex = /<item[^>]*objectid="(\d+)"[^>]*>[\s\S]*?<name[^>]*>([^<]+)<\/name>[\s\S]*?<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      games.push({ id: match[1], name: match[2] });
    }
    
    if (games.length === 0 && xml.includes("<items")) {
      // Empty collection - valid but no owned games
      console.log(`BGG collection for ${username} is empty or has no owned games`);
    }
    
    return games;
  }
  
  throw new Error("BGG collection request timed out. The collection may be too large - please try using CSV export instead.");
}

// Helper functions
const parseBool = (val: string | undefined): boolean => {
  if (!val) return false;
  const v = val.toLowerCase().trim();
  return v === "true" || v === "yes" || v === "1";
};

const buildNotes = (
  privateComment: string | undefined,
  comment: string | undefined,
): string | undefined => {
  const notes = [comment, privateComment]
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v));

  return notes.length ? notes.join("\n\n") : undefined;
};

const buildDescriptionWithNotes = (
  description: string | undefined,
  notes: string | undefined,
): string | undefined => {
  const desc = description?.trim();
  const n = notes?.trim();
  if (!desc && !n) return undefined;
  if (!n) return desc;
  if (!desc) return `**Notes:** ${n}`;
  return `${desc}\n\n**Notes:** ${n}`;
};

const buildDescription = (
  description: string | undefined,
  privateComment: string | undefined,
  comment: string | undefined,
): string | undefined => {
  return buildDescriptionWithNotes(description, buildNotes(privateComment, comment));
};

const parseNum = (val: string | undefined): number | undefined => {
  if (!val) return undefined;
  const n = parseInt(val, 10);
  return isNaN(n) ? undefined : n;
};

const parsePrice = (val: string | undefined): number | undefined => {
  if (!val) return undefined;
  // Remove currency symbols and commas, then parse as float
  const cleaned = val.replace(/[^0-9.,]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? undefined : n;
};

const parseDate = (val: string | undefined): string | undefined => {
  if (!val) return undefined;
  // BGG uses YYYY-MM-DD format
  const dateMatch = val.match(/^\d{4}-\d{2}-\d{2}$/);
  if (dateMatch) return val;
  // Try to parse other formats
  const date = new Date(val);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  return undefined;
};

const mapWeightToDifficulty = (weight: string | undefined): string | undefined => {
  if (!weight) return undefined;
  const w = parseFloat(weight);
  // BGG weight of 0 means unrated - don't map it
  if (isNaN(w) || w === 0) return undefined;
  if (w < 1.5) return "1 - Light";
  if (w < 2.25) return "2 - Medium Light";
  if (w < 3.0) return "3 - Medium";
  if (w < 3.75) return "4 - Medium Heavy";
  return "5 - Heavy";
};

const mapPlayTimeToEnum = (minutes: number | undefined): string | undefined => {
  if (!minutes) return undefined;
  if (minutes <= 15) return "0-15 Minutes";
  if (minutes <= 30) return "15-30 Minutes";
  if (minutes <= 45) return "30-45 Minutes";
  if (minutes <= 60) return "45-60 Minutes";
  if (minutes <= 120) return "60+ Minutes";
  if (minutes <= 180) return "2+ Hours";
  return "3+ Hours";
};

type GameToImport = {
  title: string;
  bgg_id?: string;
  bgg_url?: string;
  image_url?: string;
  type?: string;
  difficulty?: string;
  play_time?: string;
  min_players?: number;
  max_players?: number;
  suggested_age?: string;
  publisher?: string;
  mechanics?: string[];
  is_expansion?: boolean;
  parent_game?: string;
  is_coming_soon?: boolean;
  is_for_sale?: boolean;
  sale_price?: number;
  sale_condition?: string;
  location_room?: string;
  location_shelf?: string;
  location_misc?: string;
  sleeved?: boolean;
  upgraded_components?: boolean;
  crowdfunded?: boolean;
  inserts?: boolean;
  in_base_game_box?: boolean;

  /**
   * Internal import-only fields (not persisted directly).
   * Used to decide whether to enrich from BGG when CSV has only notes.
   */
  _csv_description?: string;
  _csv_notes?: string;

  description?: string;

  // Admin data from BGG CSV
  purchase_date?: string;
  purchase_price?: number;
};

// Export handler for self-hosted router
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Use getUser() for compatibility with both Cloud and self-hosted Supabase
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) {
      console.error("[BulkImport] Auth error:", userError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if user is either a global admin OR owns a library
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    const { data: libraryData } = await supabaseAdmin
      .from("libraries")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();

    if (!roleData && !libraryData) {
      return new Response(
        JSON.stringify({ success: false, error: "You must own a library to import games" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Defensive JSON parsing - handle empty/truncated request bodies
    let body: BulkImportRequest;
    try {
      const rawBody = await req.text();
      if (!rawBody || rawBody.trim().length === 0) {
        console.error("[BulkImport] Empty request body received");
        return new Response(
          JSON.stringify({ success: false, error: "Empty request body" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error("[BulkImport] Failed to parse request body:", parseError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { mode, library_id, csv_data, bgg_username, bgg_links, enhance_with_bgg, enhance_with_ai, default_options } = body;

    const targetLibraryId = library_id || libraryData?.id;
    if (!targetLibraryId) {
      return new Response(
        JSON.stringify({ success: false, error: "No library specified and user has no library" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

    // Collect games to import
    let gamesToImport: GameToImport[] = [];

    if (mode === "csv" && csv_data) {
      const rows = parseCSV(csv_data);
      console.log(`Parsed ${rows.length} rows from CSV`);
      
      const isBGGExport = rows.length > 0 && rows[0].objectname !== undefined;
      console.log(`CSV format detected: ${isBGGExport ? 'BGG Export' : 'Standard'}`);
      
      for (const row of rows) {
        const title = row.title || row.name || row.game || row["game name"] || row["game title"] || row.objectname;
        
        if (isBGGExport && row.own !== "1") {
          continue;
        }
        
        if (title) {
          const mechanicsStr = row.mechanics || row.mechanic || "";
          const mechanics = mechanicsStr
            .split(";")
            .map((m: string) => m.trim())
            .filter((m: string) => m.length > 0);
          
          const bggId = row.bgg_id || row["bgg id"] || row.objectid || undefined;
          const minPlayersRaw = row.min_players || row["min players"] || row.minplayers;
          const maxPlayersRaw = row.max_players || row["max players"] || row.maxplayers;
          const playTimeRaw = row.play_time || row["play time"] || row.playtime || row.playingtime;
          
          const isExpansion = parseBool(row.is_expansion || row["is expansion"]) || 
                             row.itemtype === "expansion" || 
                             row.objecttype === "expansion";
          
          // Use avgweight (community rating) for difficulty mapping, NOT row.weight (user's personal rating)
          // row.weight in BGG exports is often "0" which is invalid for the enum
          let difficulty: string | undefined = row.difficulty;
          if (!difficulty) {
            difficulty = mapWeightToDifficulty(row.avgweight || row.weight);
          }
          
          let playTime: string | undefined = row.play_time || row["play time"];
          if (!playTime && playTimeRaw) {
            const playTimeNum = parseNum(playTimeRaw);
            playTime = mapPlayTimeToEnum(playTimeNum);
          }
          
          const suggestedAge = row.suggested_age || row["suggested age"] || row.age || row.bggrecagerange || undefined;
          const isForSale = parseBool(row.is_for_sale || row["is for sale"] || row.fortrade);
          
          const csvDesc = (row.description ?? "").trim();
          const csvNotes = buildNotes(row.privatecomment, row.comment);

          const gameData: GameToImport = { 
            title,
            bgg_id: bggId,
            bgg_url: bggId ? `https://boardgamegeek.com/boardgame/${bggId}` : (row.bgg_url || row["bgg url"] || row.url || undefined),
            image_url: row.image_url || row["image url"] || row.imageurl || undefined,
            type: row.type || row["game type"] || row.game_type || undefined,
            difficulty,
            play_time: playTime,
            min_players: parseNum(minPlayersRaw),
            max_players: parseNum(maxPlayersRaw),
            suggested_age: suggestedAge,
            publisher: row.publisher || undefined,
            mechanics: mechanics.length > 0 ? mechanics : undefined,
            is_expansion: isExpansion,
            parent_game: row.parent_game || row["parent game"] || undefined,
            is_coming_soon: parseBool(row.is_coming_soon || row["is coming soon"]),
            is_for_sale: isForSale,
            sale_price: parseNum(row.sale_price || row["sale price"]),
            sale_condition: row.sale_condition || row["sale condition"] || undefined,
            location_room: row.location_room || row["location room"] || undefined,
            location_shelf: row.location_shelf || row["location shelf"] || row.invlocation || undefined,
            location_misc: row.location_misc || row["location misc"] || undefined,
            sleeved: parseBool(row.sleeved),
            upgraded_components: parseBool(row.upgraded_components || row["upgraded components"]),
            crowdfunded: parseBool(row.crowdfunded),
            inserts: parseBool(row.inserts),
            in_base_game_box: parseBool(row.in_base_game_box || row["in base game box"]),
            _csv_description: csvDesc,
            _csv_notes: csvNotes,
            description: buildDescriptionWithNotes(csvDesc, csvNotes),
            // Map BGG CSV admin data fields
            purchase_date: parseDate(row.acquisitiondate || row.acquisition_date || row.purchase_date),
            purchase_price: parsePrice(row.pricepaid || row.price_paid || row.purchase_price),
          };
          
          gamesToImport.push(gameData);
        }
      }
    } else if (mode === "bgg_collection" && bgg_username) {
      console.log(`Fetching BGG collection for: ${bgg_username}`);
      const collection = await fetchBGGCollection(bgg_username);
      console.log(`Found ${collection.length} games in collection`);
      
      for (const game of collection) {
        gamesToImport.push({
          title: game.name,
          bgg_id: game.id,
          bgg_url: `https://boardgamegeek.com/boardgame/${game.id}`,
        });
      }
    } else if (mode === "bgg_links" && bgg_links && bgg_links.length > 0) {
      for (const link of bgg_links) {
        const idMatch = link.match(/boardgame\/(\d+)/);
        if (idMatch) {
          gamesToImport.push({
            title: "",
            bgg_id: idMatch[1],
            bgg_url: link,
          });
        }
      }
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid import mode or missing data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalGames = gamesToImport.length;
    console.log(`[BulkImport] Total games to process: ${totalGames}`);
    console.log(`[BulkImport] Firecrawl key present: ${!!firecrawlKey}, Enhance with BGG: ${enhance_with_bgg}`);
    console.log(`[BulkImport] AI configured: ${isAIConfigured()}, Provider: ${getAIProviderName()}`);

    // Create import job
    console.log(`[BulkImport] Creating import job for library: ${targetLibraryId}`);
    const { data: job, error: jobError } = await supabaseAdmin
      .from("import_jobs")
      .insert({
        library_id: targetLibraryId,
        status: "processing",
        total_items: totalGames,
        processed_items: 0,
        successful_items: 0,
        failed_items: 0,
      })
      .select("id")
      .single();

    if (jobError || !job) {
      console.error(`[BulkImport] Failed to create import job:`, jobError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create import job" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jobId = job.id;
    console.log(`[BulkImport] Created job ${jobId}, starting SSE stream`);

    // Use streaming response to keep connection alive
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendProgress = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        let imported = 0;
        let failed = 0;
        const errors: string[] = [];
        const importedGames: { title: string; id?: string }[] = [];

        const failureBreakdown: FailureBreakdown = {
          already_exists: 0,
          missing_title: 0,
          create_failed: 0,
          exception: 0,
        };

        // Send initial progress
        console.log(`[BulkImport] Sending SSE start event`);
        sendProgress({ 
          type: "start", 
          jobId, 
          total: totalGames 
        });

        // Process each game
        console.log(`[BulkImport] Beginning game loop`);
        for (let i = 0; i < gamesToImport.length; i++) {
          const gameInput = gamesToImport[i];
          console.log(`[BulkImport] Processing game ${i + 1}/${gamesToImport.length}: ${gameInput.title || gameInput.bgg_id}`);

          
          try {
            let gameData: {
              title: string;
              bgg_id?: string;
              bgg_url?: string;
              description?: string;
              image_url?: string;
              min_players?: number;
              max_players?: number;
              suggested_age?: string;
              play_time?: string;
              difficulty?: string;
              game_type?: string;
              mechanics?: string[];
              publisher?: string;
              is_expansion?: boolean;
              parent_game?: string;
              is_coming_soon?: boolean;
              is_for_sale?: boolean;
              sale_price?: number;
              sale_condition?: string;
              location_room?: string;
              location_shelf?: string;
              location_misc?: string;
              sleeved?: boolean;
              upgraded_components?: boolean;
              crowdfunded?: boolean;
              inserts?: boolean;
              in_base_game_box?: boolean;
              purchase_date?: string;
              purchase_price?: number;
            } = { 
              title: gameInput.title,
              bgg_id: gameInput.bgg_id,
              bgg_url: gameInput.bgg_url,
              image_url: gameInput.image_url,
              description: gameInput.description,
              min_players: gameInput.min_players,
              max_players: gameInput.max_players,
              suggested_age: gameInput.suggested_age,
              play_time: gameInput.play_time,
              difficulty: gameInput.difficulty,
              game_type: gameInput.type,
              mechanics: gameInput.mechanics,
              publisher: gameInput.publisher,
              is_expansion: gameInput.is_expansion,
              parent_game: gameInput.parent_game,
              is_coming_soon: gameInput.is_coming_soon,
              is_for_sale: gameInput.is_for_sale,
              sale_price: gameInput.sale_price,
              sale_condition: gameInput.sale_condition,
              location_room: gameInput.location_room,
              location_shelf: gameInput.location_shelf,
              location_misc: gameInput.location_misc,
              sleeved: gameInput.sleeved,
              upgraded_components: gameInput.upgraded_components,
              crowdfunded: gameInput.crowdfunded,
              inserts: gameInput.inserts,
              in_base_game_box: gameInput.in_base_game_box,
              purchase_date: gameInput.purchase_date,
              purchase_price: gameInput.purchase_price,
            };

            // Send progress update before BGG enhancement
            sendProgress({ 
              type: "progress", 
              current: i + 1, 
              total: totalGames,
              imported,
              failed,
              currentGame: gameData.title || `BGG ID: ${gameInput.bgg_id}`,
              phase: enhance_with_ai ? "ai_enhancing" : (enhance_with_bgg !== false ? "fetching" : "importing")
            });

            // BGG enhancement - SKIP if the CSV already had a real description.
            // IMPORTANT: Notes-only rows ("**Notes:** ...") should still be enriched.
            const csvDesc = (gameInput._csv_description || "").trim();
            const hasCsvDescription = csvDesc.length > 0;
            const hasCompleteData = hasCsvDescription && csvDesc.length > 50;

            if (hasCompleteData) {
              console.log(`[BulkImport] Skipping enrichment for "${gameData.title}" - CSV description already present (${csvDesc.length} chars)`);
            } else if (gameInput.bgg_id && enhance_with_bgg !== false) {
              // FAST PATH: Use BGG XML API (default behavior)
              // This is ~10x faster than Firecrawl+AI
              console.log(`[BulkImport] Fetching BGG XML data for: ${gameInput.bgg_id}`);
              let bggData: Awaited<ReturnType<typeof fetchBGGXMLData>> | null = null;
              try {
                bggData = await fetchBGGXMLData(gameInput.bgg_id);
              } catch (e) {
                console.warn(`[BulkImport] BGG XML fetch failed for ${gameInput.bgg_id}:`, e);
                bggData = null;
              }

              if (bggData) {
                const isEmpty = (val: unknown): boolean => {
                  if (val === undefined || val === null) return true;
                  if (typeof val !== "string") return false;
                  const v = val.trim();
                  return v === "" || v.toLowerCase() === "null";
                };

                // Format the BGG description with AI if available (Quick Gameplay Overview format)
                let formattedDescription = bggData.description;
                if (bggData.description && bggData.description.length > 100 && isAIConfigured()) {
                  console.log(`[BulkImport] Formatting description with AI for: ${gameInput.bgg_id}`);
                  try {
                    const aiFormatted = await formatDescriptionWithAI(bggData.description, gameInput.bgg_id);
                    if (aiFormatted) {
                      formattedDescription = aiFormatted;
                      console.log(`[BulkImport] AI formatted description: ${aiFormatted.length} chars`);
                    }
                  } catch (e) {
                    console.warn(`[BulkImport] AI formatting failed for ${gameInput.bgg_id}, using raw BGG description:`, e);
                  }
                }

                const mergedDescription = !hasCsvDescription
                  ? buildDescriptionWithNotes(formattedDescription, gameInput._csv_notes)
                  : gameData.description;

                gameData = {
                  ...gameData,
                  bgg_id: gameData.bgg_id || bggData.bgg_id,
                  image_url: isEmpty(gameData.image_url) ? bggData.image_url : gameData.image_url,
                  description: isEmpty(mergedDescription) ? gameData.description : mergedDescription,
                  difficulty: isEmpty(gameData.difficulty) ? bggData.difficulty : gameData.difficulty,
                  play_time: isEmpty(gameData.play_time) ? bggData.play_time : gameData.play_time,
                  min_players: gameData.min_players ?? bggData.min_players,
                  max_players: gameData.max_players ?? bggData.max_players,
                  suggested_age: isEmpty(gameData.suggested_age) ? bggData.suggested_age : gameData.suggested_age,
                  mechanics: gameData.mechanics?.length ? gameData.mechanics : bggData.mechanics,
                  publisher: isEmpty(gameData.publisher) ? bggData.publisher : gameData.publisher,
                  // Override is_expansion from BGG if not already set (BGG is authoritative)
                  is_expansion: gameData.is_expansion || bggData.is_expansion,
                };

                // Ensure notes are appended after enrichment when CSV had notes.
                if (!hasCsvDescription) {
                  gameData.description = buildDescriptionWithNotes(formattedDescription, gameInput._csv_notes);
                }

                console.log(`[BulkImport] XML enriched "${gameData.title}": description=${(gameData.description?.length || 0)} chars, image=${!!gameData.image_url}`);
              }
              
              // SLOW PATH: Optionally use Firecrawl+AI for rich descriptions
              // Only when explicitly requested via enhance_with_ai=true
              if (enhance_with_ai && firecrawlKey && (!gameData.description || gameData.description.length < 100)) {
                console.log(`[BulkImport] AI enrichment for: ${gameInput.bgg_id}`);
                try {
                  const aiData = await fetchBGGData(gameInput.bgg_id, firecrawlKey);
                  if (aiData?.description && aiData.description.length > (gameData.description?.length || 0)) {
                    gameData.description = aiData.description;
                    console.log(`[BulkImport] AI enhanced description: ${aiData.description.length} chars`);
                  }
                } catch (e) {
                  console.warn(`[BulkImport] AI enrichment failed for ${gameInput.bgg_id}:`, e);
                }
              }
            } else if (enhance_with_bgg !== false && gameData.title && !hasCompleteData) {
              // No BGG ID - try to look up by title using XML search
              console.log(`[BulkImport] Looking up BGG by title: ${gameData.title}`);
              try {
                // BGG now requires authentication
                const bggApiToken = Deno.env.get("BGG_API_TOKEN");
                const searchHeaders: Record<string, string> = {
                  "User-Agent": "GameTaverns/1.0 (Bulk Import)",
                };
                if (bggApiToken) {
                  searchHeaders["Authorization"] = `Bearer ${bggApiToken}`;
                }
                
                const searchUrl = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(gameData.title)}&type=boardgame&exact=1`;
                const searchRes = await fetch(searchUrl, { headers: searchHeaders });
                if (searchRes.ok) {
                  const xml = await searchRes.text();
                  const idMatch = xml.match(/<item[^>]*id="(\d+)"/);
                  if (idMatch) {
                    const foundId = idMatch[1];
                    const bggData = await fetchBGGXMLData(foundId);
                    if (bggData) {
                      const isEmpty = (val: unknown): boolean => {
                        if (val === undefined || val === null) return true;
                        if (typeof val !== "string") return false;
                        const v = val.trim();
                        return v === "" || v.toLowerCase() === "null";
                      };

                      // Format the BGG description with AI if available
                      let formattedDescription = bggData.description;
                      if (bggData.description && bggData.description.length > 100 && isAIConfigured()) {
                        try {
                          const aiFormatted = await formatDescriptionWithAI(bggData.description, foundId);
                          if (aiFormatted) {
                            formattedDescription = aiFormatted;
                          }
                        } catch (e) {
                          console.warn(`[BulkImport] AI formatting failed for title lookup ${foundId}:`, e);
                        }
                      }

                      const mergedDescription = !hasCsvDescription
                        ? buildDescriptionWithNotes(formattedDescription, gameInput._csv_notes)
                        : gameData.description;

                      gameData = {
                        ...gameData,
                        bgg_id: foundId,
                        image_url: isEmpty(gameData.image_url) ? bggData.image_url : gameData.image_url,
                        description: isEmpty(mergedDescription) ? gameData.description : mergedDescription,
                        difficulty: isEmpty(gameData.difficulty) ? bggData.difficulty : gameData.difficulty,
                        play_time: isEmpty(gameData.play_time) ? bggData.play_time : gameData.play_time,
                        min_players: gameData.min_players ?? bggData.min_players,
                        max_players: gameData.max_players ?? bggData.max_players,
                        suggested_age: isEmpty(gameData.suggested_age) ? bggData.suggested_age : gameData.suggested_age,
                        mechanics: gameData.mechanics?.length ? gameData.mechanics : bggData.mechanics,
                        publisher: isEmpty(gameData.publisher) ? bggData.publisher : gameData.publisher,
                        // Override is_expansion from BGG if not already set
                        is_expansion: gameData.is_expansion || bggData.is_expansion,
                      };
                    }
                  }
                }
              } catch (e) {
                console.warn(`[BulkImport] Title lookup failed for "${gameData.title}":`, e);
              }
            }

            if (!gameData.title) {
              failed++;
              failureBreakdown.missing_title++;
              errors.push(`Could not determine title for BGG ID: ${gameInput.bgg_id}`);
              continue;
            }

            // Check if game already exists
            const { data: existing } = await supabaseAdmin
              .from("games")
              .select("id, title")
              .eq("title", gameData.title)
              .eq("library_id", targetLibraryId)
              .maybeSingle();

            if (existing) {
              failed++;
              failureBreakdown.already_exists++;
              errors.push(`"${gameData.title}" already exists`);
              continue;
            }

            // Handle mechanics
            const mechanicIds: string[] = [];
            if (gameData.mechanics?.length) {
              for (const name of gameData.mechanics) {
                const { data: em } = await supabaseAdmin
                  .from("mechanics")
                  .select("id")
                  .eq("name", name)
                  .maybeSingle();
                
                if (em) {
                  mechanicIds.push(em.id);
                } else {
                  const { data: nm } = await supabaseAdmin
                    .from("mechanics")
                    .insert({ name })
                    .select("id")
                    .single();
                  if (nm) mechanicIds.push(nm.id);
                }
              }
            }

            // Handle publisher
            let publisherId: string | null = null;
            if (gameData.publisher) {
              const { data: ep } = await supabaseAdmin
                .from("publishers")
                .select("id")
                .eq("name", gameData.publisher)
                .maybeSingle();
              
              if (ep) {
                publisherId = ep.id;
              } else {
                const { data: np } = await supabaseAdmin
                  .from("publishers")
                  .insert({ name: gameData.publisher })
                  .select("id")
                  .single();
                if (np) publisherId = np.id;
              }
            }

            // Handle parent game for expansions
            let parentGameId: string | null = null;
            if (gameData.is_expansion && gameData.parent_game) {
              const { data: pg } = await supabaseAdmin
                .from("games")
                .select("id")
                .eq("title", gameData.parent_game)
                .eq("library_id", targetLibraryId)
                .maybeSingle();
              
              if (pg) {
                parentGameId = pg.id;
              }
            }

            // Normalize enum values for the current environment
            gameData.difficulty = normalizeDifficulty(gameData.difficulty);
            gameData.play_time = normalizePlayTime(gameData.play_time);
            gameData.game_type = normalizeGameType(gameData.game_type);
            gameData.sale_condition = normalizeSaleCondition(gameData.sale_condition);

            // Create the game
            const { data: newGame, error: gameError } = await supabaseAdmin
              .from("games")
              .insert({
                library_id: targetLibraryId,
                title: gameData.title,
                description: gameData.description || null,
                image_url: gameData.image_url || null,
                bgg_id: gameData.bgg_id || null,
                bgg_url: gameData.bgg_url || null,
                min_players: gameData.min_players ?? 2,
                max_players: gameData.max_players ?? 4,
                suggested_age: gameData.suggested_age || null,
                play_time: gameData.play_time || (IS_SELF_HOSTED ? "45-60 Minutes" : "45-60 Minutes"),
                difficulty: gameData.difficulty || "3 - Medium",
                game_type: gameData.game_type || "Board Game",
                publisher_id: publisherId,
                is_expansion: gameData.is_expansion ?? false,
                parent_game_id: parentGameId,
                is_coming_soon: gameData.is_coming_soon ?? default_options?.is_coming_soon ?? false,
                is_for_sale: gameData.is_for_sale ?? default_options?.is_for_sale ?? false,
                sale_price: gameData.sale_price ?? default_options?.sale_price ?? null,
                sale_condition: gameData.sale_condition ?? default_options?.sale_condition ?? null,
                location_room: gameData.location_room ?? default_options?.location_room ?? null,
                location_shelf: gameData.location_shelf ?? default_options?.location_shelf ?? null,
                location_misc: gameData.location_misc ?? default_options?.location_misc ?? null,
                sleeved: gameData.sleeved ?? default_options?.sleeved ?? false,
                upgraded_components: gameData.upgraded_components ?? default_options?.upgraded_components ?? false,
                crowdfunded: gameData.crowdfunded ?? default_options?.crowdfunded ?? false,
                inserts: gameData.inserts ?? default_options?.inserts ?? false,
                in_base_game_box: gameData.in_base_game_box ?? false,
              })
              .select("id, title")
              .single();

            if (gameError || !newGame) {
              failed++;
              failureBreakdown.create_failed++;
              errors.push(`Failed to create "${gameData.title}": ${gameError?.message}`);
              continue;
            }

            // Link mechanics
            if (mechanicIds.length > 0) {
              await supabaseAdmin.from("game_mechanics").insert(
                mechanicIds.map(mid => ({ game_id: newGame.id, mechanic_id: mid }))
              );
            }

            // Create admin data if purchase info exists (from BGG CSV acquisitiondate/pricepaid fields)
            if (gameData.purchase_date || gameData.purchase_price) {
              const { error: adminError } = await supabaseAdmin
                .from("game_admin_data")
                .insert({
                  game_id: newGame.id,
                  purchase_date: gameData.purchase_date || null,
                  purchase_price: gameData.purchase_price || null,
                });
              
              if (adminError) {
                console.warn(`Failed to create admin data for "${gameData.title}": ${adminError.message}`);
              } else {
                console.log(`Created admin data for "${gameData.title}": date=${gameData.purchase_date}, price=${gameData.purchase_price}`);
              }
            }

            imported++;
            importedGames.push({ title: newGame.title, id: newGame.id });
            console.log(`Imported: ${newGame.title}`);

            // Update job progress in database
            await supabaseAdmin
              .from("import_jobs")
              .update({
                processed_items: i + 1,
                successful_items: imported,
                failed_items: failed,
              })
              .eq("id", jobId);

            // Send progress update
            sendProgress({ 
              type: "progress", 
              current: i + 1, 
              total: totalGames,
              imported,
              failed,
              currentGame: newGame.title,
              phase: "imported"
            });

            // Small delay to avoid BGG rate limits (only when doing AI enrichment which is slow anyway)
            if (enhance_with_ai) {
              await new Promise(r => setTimeout(r, 200));
            }
          } catch (e) {
            console.error("Game import error:", e);
            failed++;
            failureBreakdown.exception++;
            errors.push(`Error importing "${gameInput.title || gameInput.bgg_id}": ${e instanceof Error ? e.message : "Unknown error"}`);
            
            // Update progress even on error
            sendProgress({ 
              type: "progress", 
              current: i + 1, 
              total: totalGames,
              imported,
              failed,
              currentGame: gameInput.title || `BGG ID: ${gameInput.bgg_id}`,
              phase: "error"
            });
          }
        }

        // Second pass: Link orphaned expansions to parent games
        // BGG CSV doesn't have parent_game column, so we infer from title matching
        console.log(`[BulkImport] Second pass: Linking orphaned expansions...`);
        
        const { data: expansions } = await supabaseAdmin
          .from("games")
          .select("id, title, is_expansion, parent_game_id")
          .eq("library_id", targetLibraryId)
          .eq("is_expansion", true)
          .is("parent_game_id", null);

        if (expansions && expansions.length > 0) {
          const { data: baseGames } = await supabaseAdmin
            .from("games")
            .select("id, title")
            .eq("library_id", targetLibraryId)
            .eq("is_expansion", false);

          if (baseGames && baseGames.length > 0) {
            let linked = 0;
            for (const expansion of expansions) {
              // Try to find parent by title matching
              // Common patterns: "Base Game – Expansion" or "Base Game: Expansion"
              const expTitle = expansion.title;
              
              // Sort base games by title length descending to prefer longer (more specific) matches
              const sortedBases = [...baseGames].sort((a, b) => b.title.length - a.title.length);
              
              for (const baseGame of sortedBases) {
                // Check if expansion title starts with base game title
                if (expTitle.toLowerCase().startsWith(baseGame.title.toLowerCase())) {
                  // Verify there's a separator after the base name (-, :, –)
                  const afterBase = expTitle.substring(baseGame.title.length).trim();
                  if (afterBase.match(/^[–:\-–—]/)) {
                    // Found a match!
                    const { error: linkErr } = await supabaseAdmin
                      .from("games")
                      .update({ parent_game_id: baseGame.id })
                      .eq("id", expansion.id);
                    
                    if (!linkErr) {
                      linked++;
                      console.log(`[BulkImport] Linked expansion "${expansion.title}" → "${baseGame.title}"`);
                    }
                    break;
                  }
                }
              }
            }
            console.log(`[BulkImport] Linked ${linked} of ${expansions.length} orphaned expansions`);
          }
        }

        // Mark job as completed
        await supabaseAdmin
          .from("import_jobs")
          .update({
            status: "completed",
            processed_items: totalGames,
            successful_items: imported,
            failed_items: failed,
          })
          .eq("id", jobId);

        // Send final result
        const summaryParts: string[] = [];
        if (failureBreakdown.already_exists) summaryParts.push(`${failureBreakdown.already_exists} already existed`);
        if (failureBreakdown.missing_title) summaryParts.push(`${failureBreakdown.missing_title} missing title`);
        if (failureBreakdown.create_failed) summaryParts.push(`${failureBreakdown.create_failed} create failed`);
        if (failureBreakdown.exception) summaryParts.push(`${failureBreakdown.exception} exceptions`);
        const errorSummary = summaryParts.length ? summaryParts.join(", ") : "";

        console.log(
          `[BulkImport] Complete: imported=${imported} failed=${failed} breakdown=${JSON.stringify(failureBreakdown)}`
        );

        sendProgress({ 
          type: "complete", 
          success: true,
          imported,
          failed,
          // Keep payload small for SSE, but give enough info for debugging.
          errors: errors.slice(0, 50),
          failureBreakdown,
          errorSummary,
          games: importedGames,
        });

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    console.error("Bulk import error:", e);
    const errorMessage = e instanceof Error ? e.message : "Bulk import failed";
    
    // Return 400 for expected/user-fixable errors, 500 for unexpected server errors
    const isUserError = errorMessage.includes("BGG API requires authentication") ||
                       errorMessage.includes("not found") ||
                       errorMessage.includes("private") ||
                       errorMessage.includes("CSV export");
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: isUserError ? 400 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// For Lovable Cloud deployment (direct function invocation)
Deno.serve(handler);
