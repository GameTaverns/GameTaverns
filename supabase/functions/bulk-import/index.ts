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
    // BGG now requires authentication - prefer session cookie over API token
    const bggCookie = Deno.env.get("BGG_SESSION_COOKIE") || Deno.env.get("BGG_COOKIE") || "";
    const bggApiToken = Deno.env.get("BGG_API_TOKEN");
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    };
    if (bggCookie) {
      headers["Cookie"] = bggCookie;
    } else if (bggApiToken) {
      if (bggApiToken.includes("=") || bggApiToken.includes("SessionID")) {
        headers["Cookie"] = bggApiToken;
      } else {
        headers["Authorization"] = `Bearer ${bggApiToken}`;
      }
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
  const maxAttempts = 8;

  // BGG now requires authentication - prefer session cookie over API token
  const bggCookie2 = Deno.env.get("BGG_SESSION_COOKIE") || Deno.env.get("BGG_COOKIE") || "";
  const bggApiToken = Deno.env.get("BGG_API_TOKEN");
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  };
  if (bggCookie2) {
    headers["Cookie"] = bggCookie2;
  } else if (bggApiToken) {
    if (bggApiToken.includes("=") || bggApiToken.includes("SessionID")) {
      headers["Cookie"] = bggApiToken;
    } else {
      headers["Authorization"] = `Bearer ${bggApiToken}`;
    }
  }

  // Partial result from direct BGG XML (may have metadata but no description)
  let partialResult: Awaited<ReturnType<typeof fetchBGGXMLData>> | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(xmlUrl, { headers });

      // If not ok, return minimal info but don't fail the import.
      if (!res.ok) {
        console.warn(`[BulkImport] BGG XML API returned ${res.status} for ${bggId}${!bggCookie2 && !bggApiToken ? " (no BGG_SESSION_COOKIE or BGG_API_TOKEN configured)" : ""}`);

        // Treat 202 as retryable even if considered "ok" by some proxies.
        if (res.status === 202 && attempt < maxAttempts) {
          const backoffMs = Math.min(1500 * attempt, 8000);
          await sleep(backoffMs);
          continue;
        }

        // 401/403 means auth failed — don't retry, fall through to AI enrichment
        if (res.status === 401 || res.status === 403) {
          console.log(`[BulkImport] BGG XML auth failed for ${bggId}, falling through to AI enrichment...`);
          await res.text().catch(() => {}); // consume body
          break; // exit retry loop, fall through to AI
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
        const backoffMs = Math.min(1500 * attempt, 8000);
        console.log(`[BulkImport] BGG XML not ready for ${bggId}, retrying (${attempt}/${maxAttempts}) in ${backoffMs}ms`);
        await sleep(backoffMs);
        continue;
      }

      // Extract data using regex (simple parsing for XML)
      const imageMatch = xml.match(/<image>([^<]+)<\/image>/) || xml.match(/<thumbnail>([^<]+)<\/thumbnail>/);

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

      const directResult = {
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

      // If we got a description, return immediately. Otherwise fall through to AI enrichment.
      if (description && description.length > 50) {
        return directResult;
      }

      // Store partial result so AI can fill in missing fields
      console.log(`[BulkImport] Direct BGG XML returned no/short description for ${bggId}, falling through to AI enrichment...`);
      partialResult = directResult;
      break; // exit retry loop, fall through to AI
    } catch (e) {
      console.error("[BulkImport] BGG XML error:", e);
      if (attempt < maxAttempts) {
        const backoffMs = Math.min(1500 * attempt, 8000);
        await sleep(backoffMs);
        continue;
      }
    }
  }

  // Fallback: Use shared AI client (Perplexity primary) to generate description when BGG XML fails
  if (partialResult && (!partialResult.description || partialResult.description.length < 50)) {
    if (isAIConfigured()) {
      try {
        console.log(`[BulkImport] Using AI (${getAIProviderName()}) to generate description for BGG ID ${bggId}`);
        const prompt = `You are a board game expert. Look up the board game with BoardGameGeek ID ${bggId} (https://boardgamegeek.com/boardgame/${bggId}). Provide a JSON object with these keys:
- "description": A 2-3 sentence description of the game including its theme and core mechanics.
- "min_players": minimum player count (number)
- "max_players": maximum player count (number)  
- "suggested_age": recommended age like "10+" (string)
- "mechanics": array of game mechanic names (strings)

Return ONLY the JSON object, no extra text.`;

        const result = await aiComplete({
          messages: [
            { role: "system", content: "You are a board game encyclopedia. Return only valid JSON." },
            { role: "user", content: prompt },
          ],
          max_tokens: 800,
          tools: [
            {
              type: "function",
              function: {
                name: "game_metadata",
                description: "Return board game metadata",
                parameters: {
                  type: "object",
                  properties: {
                    description: { type: "string" },
                    min_players: { type: "number" },
                    max_players: { type: "number" },
                    suggested_age: { type: "string" },
                    mechanics: { type: "array", items: { type: "string" } },
                  },
                  required: ["description"],
                  additionalProperties: false,
                },
              },
            },
          ],
        });

        if (result.success && result.toolCallArguments) {
          const parsed = result.toolCallArguments as Record<string, unknown>;
          if (parsed.description && typeof parsed.description === "string") {
            console.log(`[BulkImport] AI generated description for ${bggId}: ${(parsed.description as string).length} chars`);
            partialResult.description = parsed.description as string;
            if (!partialResult.min_players && parsed.min_players) partialResult.min_players = parsed.min_players as number;
            if (!partialResult.max_players && parsed.max_players) partialResult.max_players = parsed.max_players as number;
            if (!partialResult.suggested_age && parsed.suggested_age) partialResult.suggested_age = parsed.suggested_age as string;
            if ((!partialResult.mechanics || partialResult.mechanics.length === 0) && parsed.mechanics) {
              partialResult.mechanics = parsed.mechanics as string[];
            }
          }
        } else if (result.content && result.content.length > 50) {
          // Fallback: try to parse raw content
          const jsonMatch = result.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.description) {
                partialResult.description = parsed.description;
                if (!partialResult.min_players && parsed.min_players) partialResult.min_players = parsed.min_players;
                if (!partialResult.max_players && parsed.max_players) partialResult.max_players = parsed.max_players;
                if (!partialResult.suggested_age && parsed.suggested_age) partialResult.suggested_age = parsed.suggested_age;
                if ((!partialResult.mechanics || partialResult.mechanics.length === 0) && parsed.mechanics) {
                  partialResult.mechanics = parsed.mechanics;
                }
              }
            } catch { /* JSON parse failed */ }
          }
          if (!partialResult.description) {
            partialResult.description = result.content.slice(0, 2000);
          }
        }
      } catch (e) {
        console.warn(`[BulkImport] AI fallback failed for ${bggId}:`, e);
      }
    }
  }

  // Return partial result from direct BGG XML + Gemini enrichment if we have one, otherwise minimal
  return partialResult || { bgg_id: bggId };
}

/**
 * Strip Perplexity/Sonar citation markers like [1], [2][3], [1][3][4] from text
 */
function stripCitationBrackets(text: string): string {
  return text.replace(/\[\d+\]/g, "").replace(/  +/g, " ").trim();
}

// Format a BGG description into structured markdown using AI
// Uses response_format instead of tool calling (Perplexity doesn't support tools)
async function formatDescriptionWithAI(rawContent: string, bggId: string): Promise<string | null> {
  if (!isAIConfigured()) {
    console.log(`[BulkImport] AI not configured, skipping description formatting for ${bggId}`);
    return null;
  }

  try {
    // Truncate input to avoid token limits
    const truncatedContent = rawContent.length > 3000 ? rawContent.slice(0, 3000) + "..." : rawContent;
    
    const systemPrompt = `You are a board game description writer. Transform the provided BGG game description into a well-structured, scannable format.

Your output MUST be a valid JSON object with a single "description" key containing a markdown string.

The description MUST follow this EXACT structure:

## Description

[1-2 sentence narrative summary about the theme and what makes the game interesting]

---

## Quick Gameplay Overview

**Goal:** [One sentence about how to win]

**On Your Turn:**
- [First action or step]
- [Second action or step]
- [Additional steps as needed]

**End Game:** [One sentence about when/how the game ends]

**Winner:** [One sentence about victory conditions]

[Optional: One closing sentence about a unique feature of this edition]

RULES:
- Total: 150-250 words
- Use proper markdown: ## for section headers (Description, Quick Gameplay Overview), **bold** for labels
- Use --- for horizontal rule between sections
- Use - for bullet points under "On Your Turn"
- Use \\n for newlines in the JSON string
- No extra text outside the JSON object

EXAMPLE OUTPUT:
{"description":"## Description\\n\\nBlokus is an abstract strategy game where players place polyomino pieces to claim territory on a board. Its simple rules hide deep tactical depth, offering accessible yet engaging spatial puzzles for all skill levels.\\n\\n---\\n\\n## Quick Gameplay Overview\\n\\n**Goal:** Be the player with the fewest unplayed pieces by placing as many as possible.\\n\\n**On Your Turn:**\\n- Start: Play your first piece touching a corner square\\n- Place Piece: Subsequent pieces must touch a corner of one of your previously placed pieces\\n- Corners Only: Your pieces of the same color cannot touch along an edge, only at corners\\n- Others: Different colored pieces can touch along edges or corners\\n\\n**End Game:** The game ends when no player can make a legal move.\\n\\n**Winner:** The player with the lowest score (sum of squares in unplaced pieces) wins. Placing all pieces gives a -20 bonus; placing the single square last gives a -5 bonus.\\n\\nThis edition features colorful polyomino pieces for a visually engaging experience."}`;

    const result = await aiComplete({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Format this board game description:\n\n${truncatedContent}` },
      ],
      max_tokens: 800,
      tools: [
        {
          type: "function",
          function: {
            name: "format_description",
            description: "Return the formatted game description as markdown",
            parameters: {
              type: "object",
              properties: {
                description: {
                  type: "string",
                  description: "The formatted markdown description with Description section, horizontal rule, and Quick Gameplay Overview section",
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

    // Handle tool call response (structured output via response_format or actual tool call)
    if (result.toolCallArguments?.description) {
      const desc = stripCitationBrackets(result.toolCallArguments.description as string);
      console.log(`[BulkImport] AI formatted description via tool call: ${desc.length} chars`);
      return desc;
    }
    
    // Try to parse content as JSON if it's a direct response
    if (result.content) {
      // First try direct JSON parse
      try {
        const parsed = JSON.parse(result.content);
        if (parsed.description) {
          const desc = stripCitationBrackets(parsed.description);
          console.log(`[BulkImport] AI formatted description via JSON content: ${desc.length} chars`);
          return desc;
        }
      } catch {
        // Not valid JSON, try other approaches
      }
      
      // Try to extract JSON from markdown code blocks
      const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1].trim());
          if (parsed.description) {
            const desc = stripCitationBrackets(parsed.description);
            console.log(`[BulkImport] AI formatted description from code block: ${desc.length} chars`);
            return desc;
          }
        } catch {
          // Fall through
        }
      }
      
      // If content looks like a properly formatted description (has the header), use it directly
      if (result.content.includes("## Description") || result.content.includes("## Quick Gameplay Overview")) {
        const desc = stripCitationBrackets(result.content);
        console.log(`[BulkImport] AI returned raw markdown directly: ${desc.length} chars`);
        return desc;
      }
      
      // Last resort: if it's substantial text, return it
      if (result.content.length > 100 && !result.content.startsWith("{")) {
        const desc = stripCitationBrackets(result.content);
        console.log(`[BulkImport] AI returned plain text: ${desc.length} chars`);
        return desc;
      }
    }

    console.warn(`[BulkImport] AI returned unexpected format for ${bggId}, no usable description extracted`);
    return null;
  } catch (e) {
    console.error(`[BulkImport] AI description error for ${bggId}:`, e);
    return null;
  }
}

// Fetch gallery images from BGG's internal JSON API (no auth required!)
// Returns high-res image URLs prioritizing gameplay/component photos
async function fetchBGGGalleryImages(
  bggId: string,
  _firecrawlKey: string | null,
  maxImages = 5
): Promise<string[]> {
  try {
    // BGG's internal gallery API - returns JSON with categorized images
    // Categories: Components, Play, BoxFront, BoxBack, Customized, Miscellaneous
    // We want gameplay (Play) and component images, sorted by popularity ("hot")
    const apiUrl = `https://api.geekdo.com/api/images?ajax=1&gallery=all&nosession=1&objectid=${bggId}&objecttype=thing&pageid=1&showcount=50&sort=hot`;
    
    console.log(`[BulkImport] Fetching gallery via BGG JSON API for BGG ID: ${bggId}`);
    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Referer": "https://boardgamegeek.com/",
      },
    });

    if (!res.ok) {
      console.warn(`[BulkImport] BGG gallery API returned ${res.status} for ${bggId}`);
      return [];
    }

    const data = await res.json();
    const images = data?.images;
    if (!Array.isArray(images) || images.length === 0) {
      console.log(`[BulkImport] BGG gallery API returned no images for ${bggId}`);
      return [];
    }

    // Categorize images: prioritize Play > Components > Misc/Custom > BoxFront/BoxBack
    const categorized: { url: string; priority: number; isBoxArt: boolean }[] = [];
    const seen = new Set<string>();

    for (const img of images) {
      const url = img.imageurl_lg;
      if (!url || typeof url !== "string") continue;
      
      const cleanUrl = url.replace(/\\\//g, "/");
      const imageId = img.imageid || cleanUrl;
      if (seen.has(imageId)) continue;
      seen.add(imageId);
      
      if (/micro|thumb|avatar|_mt|_t$/i.test(cleanUrl)) continue;
      
      // Determine category priority from BGG metadata
      const href = (img.imagepagehref || "").toLowerCase();
      const caption = (img.caption || "").toLowerCase();
      let priority = 5; // default
      let isBoxArt = false;
      if (href.includes("/play") || caption.includes("play") || caption.includes("gameplay")) priority = 1;
      else if (href.includes("/component") || caption.includes("component") || caption.includes("setup")) priority = 2;
      else if (href.includes("/custom") || caption.includes("custom") || caption.includes("painted")) priority = 3;
      else if (href.includes("/miscellaneous") || caption.includes("misc")) priority = 4;
      else if (href.includes("/boxfront") || href.includes("/boxback") || caption.includes("box")) {
        priority = 6; // Box art deprioritized
        isBoxArt = true;
      }
      
      categorized.push({ url: cleanUrl, priority, isBoxArt });
    }

    // Sort by priority (lower = better), then take top N
    categorized.sort((a, b) => a.priority - b.priority);
    
    // Prefer non-box-art images; only include box art if we don't have enough gameplay/component shots
    const nonBoxArt = categorized.filter(c => !c.isBoxArt);
    const boxArt = categorized.filter(c => c.isBoxArt);
    
    // Take non-box-art first, fill remaining slots with box art if needed
    const selected = nonBoxArt.slice(0, maxImages);
    if (selected.length < maxImages) {
      selected.push(...boxArt.slice(0, maxImages - selected.length));
    }
    
    const result = selected.map(c => c.url);

    console.log(`[BulkImport] BGG gallery API found ${result.length} images (${nonBoxArt.length} gameplay/components, ${boxArt.length} box art) for BGG ID: ${bggId}`);
    return result;
  } catch (e) {
    console.error(`[BulkImport] BGG gallery API error for ${bggId}:`, e);
    return [];
  }
}

// Fetch full BGG data using Firecrawl + AI with retry logic
async function fetchBGGData(
  bggId: string,
  firecrawlKey: string,
  maxRetries = 1,
  fetchGalleryImages = false
): Promise<{
  bgg_id: string;
  description?: string;
  image_url?: string;
  additional_images?: string[];
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
        console.warn(`[BulkImport] Firecrawl returned ${scrapeRes.status} for ${pageUrl}`);
        if (scrapeRes.status === 402) {
          // Payment required - don't retry, break immediately
          console.warn(`[BulkImport] Firecrawl 402 (payment required) — skipping all retries`);
          break;
        }
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
      // Normalize the scraped image URL (Firecrawl often gets Cloudflare-resized URLs with filters)
      const mainImageRaw: string | null = filtered[0] || null;
      const mainImage = mainImageRaw ? normalizeImageUrl(mainImageRaw) : null;
      
      // We have an image from Firecrawl; now try to get enriched description from AI
      // if markdown content is available
      if (markdown && markdown.length > 200) {
        console.log(`[BulkImport] Attempting AI description formatting for ${bggId}`);
        const aiDescription = await formatDescriptionWithAI(markdown.slice(0, 10000), bggId);
        if (aiDescription) {
          console.log(`[BulkImport] AI formatted description for ${bggId}: ${aiDescription.length} chars`);
          // Get additional data from BGG XML for player counts, etc.
          const xmlData = await fetchBGGXMLData(bggId);
          
          // Fetch gallery images if requested
          let additionalImages: string[] | undefined;
          if (fetchGalleryImages) {
            additionalImages = await fetchBGGGalleryImages(bggId, firecrawlKey, 5);
          }
          
          return {
            ...xmlData,
            bgg_id: bggId,
            // Prefer XML API image (always clean), fall back to normalized scraped image
            image_url: xmlData?.image_url || mainImage || null,
            description: aiDescription,
            additional_images: additionalImages?.length ? additionalImages : undefined,
          };
        }
      }
      
      // AI formatting failed or no content - fall back to BGG XML
      console.log(`[BulkImport] Firecrawl got image for ${bggId}, using BGG XML for other data`);
      const xmlData = await fetchBGGXMLData(bggId);
      
      // Fetch gallery images if requested
      let additionalImages: string[] | undefined;
      if (fetchGalleryImages) {
        additionalImages = await fetchBGGGalleryImages(bggId, firecrawlKey, 5);
      }
      
      return {
        ...xmlData,
        bgg_id: bggId,
        // Prefer XML API image (always clean), fall back to normalized scraped image
        image_url: xmlData?.image_url || mainImage || null,
        additional_images: additionalImages?.length ? additionalImages : undefined,
      };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn(`[BulkImport] Firecrawl attempt ${attempt} failed for ${bggId}:`, e);
    }
  }
  
  // All Firecrawl retries failed - fallback to BGG XML API
  console.log(`[BulkImport] Firecrawl failed after ${maxRetries} attempts, using BGG XML fallback for ${bggId}`);
  const xmlFallback = await fetchBGGXMLData(bggId);
  
  // Still try to fetch gallery images even if main scrape failed
  if (fetchGalleryImages && xmlFallback) {
    try {
      const additionalImages = await fetchBGGGalleryImages(bggId, firecrawlKey, 5);
      if (additionalImages.length > 0) {
        return { ...xmlFallback, additional_images: additionalImages };
      }
    } catch (e) {
      console.warn(`[BulkImport] Gallery fetch failed for ${bggId}:`, e);
    }
  }
  
  return xmlFallback;
}

// Fetch BGG collection for a user
async function fetchBGGCollection(username: string): Promise<{ id: string; name: string }[]> {
  const collectionUrl = `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(username)}&own=1&excludesubtype=boardgameexpansion`;
  
  // BGG now requires authentication - prefer session cookie
  const bggCookie3 = Deno.env.get("BGG_SESSION_COOKIE") || Deno.env.get("BGG_COOKIE") || "";
  const bggToken = Deno.env.get("BGG_API_TOKEN");
  
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "application/xml",
  };
  
  if (bggCookie3) {
    headers["Cookie"] = bggCookie3;
  } else if (bggToken) {
    if (bggToken.includes("=") || bggToken.includes("SessionID")) {
      headers["Cookie"] = bggToken;
    } else {
      headers["Authorization"] = `Bearer ${bggToken}`;
    }
  }
  
  console.log(`[BulkImport] Fetching BGG collection for "${username}", cookie present: ${Boolean(bggCookie3)}, token present: ${Boolean(bggToken)}`);

  let xml = "";
  let directSuccess = false;

  // --- Attempt 1: Direct BGG API ---
  let attempts = 0;
  while (attempts < 5) {
    const res = await fetch(collectionUrl, { headers });
    
    if (res.status === 202) {
      // BGG is processing the request, wait and retry
      console.log(`[BulkImport] BGG collection 202 (processing), retrying in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
      attempts++;
      continue;
    }
    
    if (res.status === 401 || res.status === 403) {
      console.warn(`[BulkImport] BGG collection API returned ${res.status} — auth failed`);
      await res.text().catch(() => {}); // consume body
      break;
    }
    
    if (res.status === 404 || res.status === 400) {
      throw new Error(`BGG username "${username}" not found or collection is private. Please check the username is correct and your collection is public.`);
    }
    
    if (!res.ok) {
      console.warn(`[BulkImport] BGG collection API returned ${res.status}`);
      await res.text().catch(() => {});
      break;
    }
    
    xml = await res.text();
    directSuccess = true;
    break;
  }

  if (!xml) {
    throw new Error(
      "BGG API requires authentication. Please ensure your BGG_SESSION_COOKIE is valid. As an alternative, export your collection as CSV from BoardGameGeek (Collection → Export) and use the CSV import option instead."
    );
  }

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
    console.log(`BGG collection for ${username} is empty or has no owned games`);
  }
  
  console.log(`[BulkImport] Parsed ${games.length} games from BGG collection for "${username}"`);
  return games;
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
  // BG Stats uses YYYYMMDD format (compact, no separators)
  const compactMatch = val.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
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
  additional_images?: string[]; // Added for gameplay/component photos
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
  copies_owned?: number;
};

// Sanitize malformed URLs from HTML scraping.
// IMPORTANT: Do NOT restructure valid BGG CDN URLs — the /img/HASH/ segment is required.
// Do NOT swap __opengraph to __original — each variant has a unique cryptographic signature
// in the /img/SIGNATURE=/ segment. Swapping the variant name while keeping the old signature
// produces an invalid URL that BGG CDN rejects with HTTP 400.
// Instead, just clean scraping artifacts and let isLowQualityBggImageUrl() flag bad URLs
// so the import can fetch a proper URL from the BGG thing XML API.
function normalizeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  // Clean malformed URL junk from HTML scraping (e.g., &quot;); trailing garbage)
  let cleaned = url
    .replace(/&quot;.*$/i, "")       // Remove &quot; and everything after
    .replace(/["');},\s]+$/g, "")    // Remove trailing quotes, parens, brackets, commas, whitespace
    .replace(/%22.*$/i, "")          // Remove encoded quote and everything after
    .replace(/[\r\n\t]+/g, "")       // Remove any newlines/tabs
    .trim();

  if (!cleaned) return undefined;

  // Validate it's actually a URL
  try {
    new URL(cleaned);
  } catch {
    return undefined;
  }

  // NOTE: We intentionally do NOT convert __opengraph → __original here.
  // BGG CDN URLs include a cryptographic signature per variant. Changing the variant
  // name without updating the signature produces 400 errors from the CDN.
  // The correct approach is to fetch the proper URL from the BGG thing XML API,
  // which returns the canonical __original URL with the correct signature.

  return cleaned;
}

function isLowQualityBggImageUrl(url: string | undefined): boolean {
  if (!url) return false; // undefined/null means "no image", not "low quality" — let caller handle
  if (!url.includes("geekdo-images.com") && !url.includes("geekdo-static.com")) return false;

  return /__opengraph|__opengraph_letterbox|__small|__thumb|__micro|__square\d*|fit-in\/1200x630|fit-in\/200x150|fit-in\/100x100|filters:strip_icc\(\)|filters:fill\(blur\)|crop\d+|\b1200x630\b/i.test(url);
}

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
    // Play log rows extracted from BG Stats CSV exports
    let playLogRows: { bgg_id: string; title: string; play_date: string; plays: number }[] = [];

    if (mode === "csv" && csv_data) {
      const rows = parseCSV(csv_data);
      console.log(`Parsed ${rows.length} rows from CSV`);
      
      const isBGGExport = rows.length > 0 && rows[0].objectname !== undefined;
      // Detect BG Stats app export format (has bggid + playdateymd columns)
      const isBGStatsExport = rows.length > 0 && (rows[0].bggid !== undefined || rows[0].playdateymd !== undefined);
      console.log(`CSV format detected: ${isBGGExport ? 'BGG Export' : isBGStatsExport ? 'BG Stats Export' : 'Standard'}`);

      // BG Stats export: separate collection rows from play log rows
      // Collection rows have statusowned=1 and no playdateymd
      // Play rows have playdateymd and no statusowned
      
      for (const row of rows) {
        // BG Stats column aliases
        const title = row.title || row.name || row.game || row["game name"] || row["game title"] || row.objectname;
        
        // BG Stats: rows with a play date are play log entries, not collection entries
        const playDateRaw = row.playdateymd || row.play_date || row.playdate || undefined;
        if (isBGStatsExport && playDateRaw) {
          const bggId = row.bggid || row.bgg_id || row["bgg id"] || row.objectid || undefined;
          const parsedDate = parseDate(playDateRaw);
          if (bggId && title && parsedDate) {
            const playCount = parseInt(row.plays || "1", 10) || 1;
            playLogRows.push({ bgg_id: bggId, title, play_date: parsedDate, plays: playCount });
          }
          continue; // Don't treat play rows as game collection entries
        }

        if (isBGGExport && row.own !== "1") {
          continue;
        }

        // BG Stats: skip rows that aren't owned (statusowned column)
        if (isBGStatsExport && row.statusowned !== undefined && row.statusowned !== "1") {
          continue;
        }
        
        if (title) {
          const mechanicsStr = row.mechanics || row.mechanic || "";
          const mechanics = mechanicsStr
            .split(";")
            .map((m: string) => m.trim())
            .filter((m: string) => m.length > 0);
          
          
          // BGG ID can be missing in Cloud-export CSVs; derive it from URL when needed
          const bggUrlCandidate = row.bgg_url || row["bgg url"] || row.url || row["bgg_url"] || "";
          const bggIdFromUrl = bggUrlCandidate
            ? (bggUrlCandidate.match(/\/boardgame\/(\d+)/)?.[1] || bggUrlCandidate.match(/\/boardgameversion\/(\d+)/)?.[1] || bggUrlCandidate.match(/\bid=(\d+)\b/)?.[1])
            : undefined;

          // BG Stats uses "bggid" (no underscore)
          const bggId = row.bgg_id || row["bgg id"] || row.objectid || row.bggid || bggIdFromUrl || undefined;
          const minPlayersRaw = row.min_players || row["min players"] || row.minplayers;
          const maxPlayersRaw = row.max_players || row["max players"] || row.maxplayers;
          const playTimeRaw = row.play_time || row["play time"] || row.playtime || row.playingtime;

          // Detect expansion from multiple possible sources
          const isExpansionFromCSV = parseBool(row.is_expansion || row["is expansion"]);
          const isExpansionFromItemType = row.itemtype === "expansion";
          const isExpansionFromObjectType = row.objecttype === "expansion";
          const isExpansion = isExpansionFromCSV || isExpansionFromItemType || isExpansionFromObjectType;
          
          // Log expansion detection for debugging
          if (isExpansion) {
            console.log(`[BulkImport] Detected expansion: "${title}" (itemtype=${row.itemtype}, objecttype=${row.objecttype}, is_expansion=${row.is_expansion})`);
          }
          
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

          // Parse additional_images (semicolon-separated list)
          const additionalImagesRaw = row.additional_images || row["additional images"] || row.additionalimages || "";
          const additionalImages = additionalImagesRaw
            ? additionalImagesRaw.split(";").map((s: string) => normalizeImageUrl(s.trim())).filter(Boolean) as string[]
            : undefined;

          const gameData: GameToImport = { 
            title,
            bgg_id: bggId,
            bgg_url: bggId ? `https://boardgamegeek.com/boardgame/${bggId}` : (row.bgg_url || row["bgg url"] || row.url || undefined),
            image_url: normalizeImageUrl(row.image_url || row["image url"] || row.imageurl || undefined),
            additional_images: additionalImages,
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
            // BG Stats: copies column
            copies_owned: parseNum(row.copies || row.copies_owned || row["copies owned"]),
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
    console.log(`[BulkImport] Enhance with BGG: ${enhance_with_bgg}, Enhance with AI: ${enhance_with_ai}`);
    console.log(`[BulkImport] Firecrawl key present: ${!!firecrawlKey}, AI configured: ${isAIConfigured()}, Provider: ${getAIProviderName()}`);

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
        let updated = 0;
        let failed = 0;
        const errors: string[] = [];
        const importedGames: { title: string; id?: string }[] = [];

        // Debug counters so the UI can tell whether enrichment actually happened.
        // (This is critical for self-hosted deployments where server-side logs may not be visible.)
        let bggXmlAttempts = 0;
        let bggXmlWithImage = 0;
        let galleryAttempts = 0;
        let galleryWithImages = 0;
        let aiEnrichAttempts = 0;

        const debug = {
          enhance_with_bgg: enhance_with_bgg !== false,
          enhance_with_ai: Boolean(enhance_with_ai),
          firecrawl_key_present: Boolean(firecrawlKey),
          ai_configured: isAIConfigured(),
          ai_provider: getAIProviderName(),
          bgg_api_token_present: Boolean(Deno.env.get("BGG_API_TOKEN")),
        };

        const failureBreakdown: FailureBreakdown = {
          already_exists: 0,
          missing_title: 0,
          create_failed: 0,
          exception: 0,
        };

        // Send initial progress
        console.log(`[BulkImport] Sending SSE start event`);

        // NOTE: JSON.stringify omits keys with `undefined` values.
        // We ensure debug is always a plain object so it reliably appears in SSE.
        const debugPayload = { ...debug, debug_version: "bulk-import-2026-02-08" };

        sendProgress({
          type: "start",
          jobId,
          total: totalGames,
          debug: debugPayload,
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
              additional_images?: string[];
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
              additional_images: gameInput.additional_images,
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

            // Normalize/clean the CSV-provided image immediately so even "skip enrichment" rows
            // don't get stuck with cropped OpenGraph variants.
            gameData.image_url = normalizeImageUrl(gameData.image_url);

            const hasLowQualityImage = isLowQualityBggImageUrl(gameData.image_url) || isLowQualityBggImageUrl(gameInput.image_url);

            // BGG enhancement - SKIP if the CSV already had a real description.
            // IMPORTANT: Notes-only rows ("**Notes:** ...") should still be enriched.
            const csvDesc = (gameInput._csv_description || "").trim();
            const hasCsvDescription = csvDesc.length > 0;
            const hasCompleteData = hasCsvDescription && csvDesc.length > 50;

            if (hasCompleteData) {
              console.log(`[BulkImport] CSV description present for "${gameData.title}" (${csvDesc.length} chars) - skipping description enrichment`);

              // Even if we skip description enrichment, we still want to fix cropped/low-quality images
              // when Enhance with BGG is enabled.
              const needsImageFix = !gameData.image_url || hasLowQualityImage;
              
              if (enhance_with_bgg !== false && needsImageFix) {
                // Try BGG XML by ID first, then fall back to title-based search
                let resolvedBggId = gameInput.bgg_id;
                
                if (!resolvedBggId && gameData.title) {
                  // No bgg_id available - try title-based search to get one
                  console.log(`[BulkImport] No BGG ID for "${gameData.title}", searching by title for image...`);
                  try {
                    const bggCookieSearch = Deno.env.get("BGG_SESSION_COOKIE") || Deno.env.get("BGG_COOKIE") || "";
                    const bggApiTokenSearch = Deno.env.get("BGG_API_TOKEN");
                    const searchHeaders: Record<string, string> = {
                      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                    };
                    if (bggCookieSearch) {
                      searchHeaders["Cookie"] = bggCookieSearch;
                    } else if (bggApiTokenSearch) {
                      searchHeaders["Cookie"] = bggApiTokenSearch.includes("=") ? bggApiTokenSearch : "";
                      if (!searchHeaders["Cookie"]) searchHeaders["Authorization"] = `Bearer ${bggApiTokenSearch}`;
                    }
                    
                    const searchUrl = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(gameData.title)}&type=boardgame&exact=1`;
                    const searchRes = await fetch(searchUrl, { headers: searchHeaders });
                    if (searchRes.ok) {
                      const xml = await searchRes.text();
                      const idMatch = xml.match(/<item[^>]*id="(\d+)"/);
                      if (idMatch) {
                        resolvedBggId = idMatch[1];
                        // Also store the bgg_id for this game so it persists
                        gameData.bgg_id = resolvedBggId;
                        gameData.bgg_url = `https://boardgamegeek.com/boardgame/${resolvedBggId}`;
                        console.log(`[BulkImport] Found BGG ID ${resolvedBggId} for "${gameData.title}" via title search`);
                      }
                    }
                  } catch (e) {
                    console.warn(`[BulkImport] Title search for image failed for "${gameData.title}":`, e);
                  }
                }

                if (resolvedBggId) {
                  console.log(`[BulkImport] Replacing low-quality image via BGG XML for: ${resolvedBggId}`);
                  try {
                    bggXmlAttempts++;
                    const bggData = await fetchBGGXMLData(resolvedBggId);
                    if (bggData?.image_url) {
                      bggXmlWithImage++;
                      gameData.image_url = normalizeImageUrl(bggData.image_url);
                    }
                    // Also backfill missing metadata even when description is complete
                    if (bggData) {
                      const isEmpty = (val: unknown): boolean => {
                        if (val === undefined || val === null) return true;
                        if (typeof val !== "string") return false;
                        return val.trim() === "" || val.trim().toLowerCase() === "null";
                      };
                      if (isEmpty(gameData.difficulty)) gameData.difficulty = bggData.difficulty;
                      if (isEmpty(gameData.play_time)) gameData.play_time = bggData.play_time;
                      if (!gameData.min_players) gameData.min_players = bggData.min_players;
                      if (!gameData.max_players) gameData.max_players = bggData.max_players;
                      if (isEmpty(gameData.suggested_age)) gameData.suggested_age = bggData.suggested_age;
                      if (!gameData.mechanics?.length) gameData.mechanics = bggData.mechanics;
                      if (isEmpty(gameData.publisher)) gameData.publisher = bggData.publisher;
                      if (bggData.is_expansion && !gameData.is_expansion) gameData.is_expansion = bggData.is_expansion;
                    }
                  } catch (e) {
                    console.warn(`[BulkImport] Image-only XML enrichment failed for ${resolvedBggId}:`, e);
                  }
                }
              }

              // Fetch gallery images via BGG JSON API
               const needsGalleryImages = !gameData.additional_images || gameData.additional_images.length === 0;
               if (needsGalleryImages && (gameInput.bgg_id || gameData.bgg_id)) {
                 const galleryBggId = gameInput.bgg_id || gameData.bgg_id!;
                 console.log(`[BulkImport] Fetching gallery images (description already present) for: ${galleryBggId}`);
                 try {
                   galleryAttempts++;
                   const galleryImages = await fetchBGGGalleryImages(galleryBggId, firecrawlKey || null, 5);
                   if (galleryImages.length > 0) {
                     galleryWithImages++;
                     gameData.additional_images = galleryImages;
                     console.log(`[BulkImport] Added ${galleryImages.length} gallery images for "${gameData.title}"`);
                   }
                 } catch (e) {
                   console.warn(`[BulkImport] Gallery fetch failed for ${galleryBggId}:`, e);
                 }
               }
            } else if (gameInput.bgg_id && enhance_with_bgg !== false) {
              // FAST PATH: Use BGG XML API (default behavior)
              // This is ~10x faster than Firecrawl+AI
               console.log(`[BulkImport] Fetching BGG XML data for: ${gameInput.bgg_id}`);
               let bggData: Awaited<ReturnType<typeof fetchBGGXMLData>> | null = null;
               try {
                 bggXmlAttempts++;
                 bggData = await fetchBGGXMLData(gameInput.bgg_id);
                 if (bggData?.image_url) bggXmlWithImage++;
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

                 const shouldUseBggImage =
                   isEmpty(gameData.image_url) ||
                   (bggData.image_url && isLowQualityBggImageUrl(gameData.image_url));

                 gameData = {
                   ...gameData,
                   bgg_id: gameData.bgg_id || bggData.bgg_id,
                   image_url: shouldUseBggImage ? normalizeImageUrl(bggData.image_url) : gameData.image_url,
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
              
               // SLOW PATH: Use AI for rich descriptions + BGG JSON API for gallery images
              {
                const needsDescription = !gameData.description || gameData.description.length < 100;
                const needsGalleryImages = !gameData.additional_images || gameData.additional_images.length === 0;
                
                // AI enrichment path (Firecrawl + AI for descriptions)
                if (enhance_with_ai && firecrawlKey && (needsDescription || needsGalleryImages)) {
                   console.log(`[BulkImport] AI enrichment for: ${gameInput.bgg_id} (desc=${needsDescription}, gallery=${needsGalleryImages})`);
                   try {
                     aiEnrichAttempts++;
                     galleryAttempts += needsGalleryImages ? 1 : 0;
                     const aiData = await fetchBGGData(gameInput.bgg_id, firecrawlKey, 3, needsGalleryImages);
                     if (aiData?.description && aiData.description.length > (gameData.description?.length || 0)) {
                       gameData.description = aiData.description;
                       console.log(`[BulkImport] AI enhanced description: ${aiData.description.length} chars`);
                     }
                     if (aiData?.additional_images && aiData.additional_images.length > 0) {
                       galleryWithImages++;
                       gameData.additional_images = aiData.additional_images;
                       console.log(`[BulkImport] Added ${aiData.additional_images.length} gallery images`);
                       // Use first gallery image as primary if we have none
                       if (!gameData.image_url || isLowQualityBggImageUrl(gameData.image_url)) {
                         gameData.image_url = aiData.additional_images[0];
                         gameData.additional_images = aiData.additional_images.slice(1);
                         console.log(`[BulkImport] Using first gallery image as primary`);
                       }
                     }
                   } catch (e) {
                     console.warn(`[BulkImport] AI enrichment failed for ${gameInput.bgg_id}:`, e);
                   }
                }
                
                // If we still need gallery images, fetch via BGG JSON API
                if ((!gameData.additional_images || gameData.additional_images.length === 0) && gameInput.bgg_id) {
                  console.log(`[BulkImport] Fetching gallery via BGG JSON API for: ${gameInput.bgg_id}`);
                  try {
                    galleryAttempts++;
                    let galleryImages = await fetchBGGGalleryImages(gameInput.bgg_id, null, 5);
                    
                    // Deluxe/special edition: ALWAYS merge with base game gallery
                    // for better gameplay/component image coverage
                    if (gameData.title) {
                      const editionPatterns = /\b(deluxe|collector'?s?|anniversary|big box|kickstarter|premium|special)\s*(edition)?\b/i;
                      if (editionPatterns.test(gameData.title)) {
                        const baseTitle = gameData.title.replace(editionPatterns, "").replace(/[:\-–—]\s*$/, "").trim();
                        console.log(`[BulkImport] Edition detected, merging with base title: "${baseTitle}"`);
                        try {
                          const searchUrl = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(baseTitle)}&type=boardgame&exact=1`;
                          const searchRes = await fetch(searchUrl, {
                            headers: { "User-Agent": "GameTaverns/1.0 (BGG Import)" },
                          });
                          if (searchRes.ok) {
                            const searchXml = await searchRes.text();
                            const idMatch = searchXml.match(/id="(\d+)"/);
                            if (idMatch && idMatch[1] !== gameInput.bgg_id) {
                              console.log(`[BulkImport] Found base game BGG ID: ${idMatch[1]}, fetching gallery`);
                              const baseImages = await fetchBGGGalleryImages(idMatch[1], null, 5);
                              if (baseImages.length > 0) {
                                // Merge: deduplicate, edition images first then base game images
                                const existingSet = new Set(galleryImages);
                                const newFromBase = baseImages.filter(u => !existingSet.has(u));
                                galleryImages = [...galleryImages, ...newFromBase].slice(0, 5);
                                console.log(`[BulkImport] Merged galleries: ${galleryImages.length} total (${newFromBase.length} added from base game)`);
                              }
                            }
                          }
                        } catch (e) {
                          console.warn(`[BulkImport] Base game lookup failed:`, e);
                        }
                      }
                    }
                        } catch (e) {
                          console.warn(`[BulkImport] Base game lookup failed:`, e);
                        }
                      }
                    }
                    
                    if (galleryImages.length > 0) {
                      galleryWithImages++;
                      gameData.additional_images = galleryImages;
                      console.log(`[BulkImport] BGG gallery API added ${galleryImages.length} gallery images`);
                      
                      // If we have no primary image, use the first gallery image
                      if (!gameData.image_url || isLowQualityBggImageUrl(gameData.image_url)) {
                        gameData.image_url = galleryImages[0];
                        console.log(`[BulkImport] Using first gallery image as primary: ${galleryImages[0].slice(-40)}`);
                        // Remove from additional_images to avoid duplication
                        gameData.additional_images = galleryImages.slice(1);
                      }
                    }
                  } catch (e) {
                    console.warn(`[BulkImport] BGG gallery API failed for ${gameInput.bgg_id}:`, e);
                  }
                }

                // FINAL FALLBACK: If we still have no description after all enrichment,
                // use Perplexity/AI to generate one from the game title
                if ((!gameData.description || gameData.description.length < 50) && isAIConfigured()) {
                  const gameTitle = gameData.title || `BGG ID ${gameInput.bgg_id}`;
                  console.log(`[BulkImport] Final AI description generation for: "${gameTitle}" (${getAIProviderName()})`);
                  try {
                    const prompt = `You are a board game expert. The board game "${gameTitle}" has BGG ID ${gameInput.bgg_id} (https://boardgamegeek.com/boardgame/${gameInput.bgg_id}). Write a brief 2-3 sentence description of this game covering its theme and core mechanics.`;
                    const result = await aiComplete({
                      messages: [
                        { role: "system", content: "You are a board game encyclopedia. Write concise, accurate game descriptions." },
                        { role: "user", content: prompt },
                      ],
                      max_tokens: 500,
                    });
                    if (result.success && result.content && result.content.length > 30) {
                      console.log(`[BulkImport] Final AI generated description: ${result.content.length} chars`);
                      // Now format it with the standard formatter
                      const formatted = await formatDescriptionWithAI(result.content, gameInput.bgg_id);
                      gameData.description = formatted || stripCitationBrackets(result.content);
                    }
                  } catch (e) {
                    console.warn(`[BulkImport] Final AI description generation failed for "${gameTitle}":`, e);
                  }
                }
              }
            } else if (enhance_with_bgg !== false && gameData.title && !hasCompleteData) {
              // No BGG ID - try to look up by title using XML search
              console.log(`[BulkImport] Looking up BGG by title: ${gameData.title}`);
              try {
                // BGG now requires authentication - prefer session cookie
                const bggCookie4 = Deno.env.get("BGG_SESSION_COOKIE") || Deno.env.get("BGG_COOKIE") || "";
                const bggApiToken4 = Deno.env.get("BGG_API_TOKEN");
                const searchHeaders: Record<string, string> = {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                };
                if (bggCookie4) {
                  searchHeaders["Cookie"] = bggCookie4;
                } else if (bggApiToken4) {
                  if (bggApiToken4.includes("=") || bggApiToken4.includes("SessionID")) {
                    searchHeaders["Cookie"] = bggApiToken4;
                  } else {
                    searchHeaders["Authorization"] = `Bearer ${bggApiToken4}`;
                  }
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
                      
                      // Also fetch gallery images - try Firecrawl first, fall back to direct scrape
                      if (!gameData.additional_images || gameData.additional_images.length === 0) {
                        console.log(`[BulkImport] Fetching gallery images for title lookup: ${foundId}`);
                        try {
                          const galleryImages = await fetchBGGGalleryImages(foundId, firecrawlKey || null, 5);
                          if (galleryImages.length > 0) {
                            gameData.additional_images = galleryImages;
                            console.log(`[BulkImport] Added ${galleryImages.length} gallery images for "${gameData.title}"`);
                          }
                        } catch (e) {
                          console.warn(`[BulkImport] Gallery fetch failed for ${foundId}:`, e);
                        }
                      }
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
            // NOTE: CSV re-imports are commonly used to "refresh" media URLs AND
            // fill in missing metadata (descriptions, player counts, etc.) that
            // may have been missed on a prior import due to network issues.
            const { data: existing } = await supabaseAdmin
              .from("games")
              .select("id, title, image_url, additional_images, description, min_players, max_players, difficulty, play_time, game_type, suggested_age, publisher_id, is_expansion, parent_game_id, bgg_id, bgg_url")
              .eq("title", gameData.title)
              .eq("library_id", targetLibraryId)
              .maybeSingle();

            const isBggCdnUrl = (u: string | null | undefined) => {
              if (!u) return false;
              try {
                const parsed = new URL(u);
                return parsed.hostname === "cf.geekdo-images.com" || parsed.hostname === "cf.geekdo-static.com";
              } catch {
                return false;
              }
            };

            const looksLikeBggLowQuality = (u: string | null | undefined) => {
              if (!u) return false;
              return (
                u.includes("__opengraph") ||
                u.includes("__small") ||
                u.includes("__thumb") ||
                u.includes("/fit-in/") ||
                u.includes("filters:strip_icc") ||
                u.includes("filters:fill(blur)")
              );
            };

            if (existing) {
              // Build a patch of missing/improved data for existing games
              const incomingImage = gameData.image_url || null;
              const existingImage = (existing as any).image_url as string | null;

              const shouldUpdateImage =
                incomingImage &&
                incomingImage !== existingImage &&
                !isLowQualityBggImageUrl(incomingImage) &&
                (looksLikeBggLowQuality(existingImage) || !existingImage);

              const incomingAdditional = gameData.additional_images || null;
              const existingAdditional = (existing as any).additional_images as string[] | null;
              const shouldUpdateAdditional =
                !!incomingAdditional?.length && (!existingAdditional || existingAdditional.length === 0);

              // NEW: Also patch description and other metadata when the existing game is missing them
              const existingDesc = ((existing as any).description as string | null) || "";
              const shouldUpdateDescription =
                existingDesc.trim().length === 0 &&
                gameData.description &&
                gameData.description.trim().length > 0;

              const patch: Record<string, unknown> = {};
              if (shouldUpdateImage) patch.image_url = incomingImage;
              if (shouldUpdateAdditional) patch.additional_images = incomingAdditional;
              if (shouldUpdateDescription) patch.description = gameData.description;

              // Patch missing numeric/enum fields
              if (!(existing as any).min_players && gameData.min_players) patch.min_players = gameData.min_players;
              if (!(existing as any).max_players && gameData.max_players) patch.max_players = gameData.max_players;
              if (!(existing as any).suggested_age && gameData.suggested_age) patch.suggested_age = gameData.suggested_age;
              if (!(existing as any).difficulty && gameData.difficulty) patch.difficulty = gameData.difficulty;
              if (!(existing as any).play_time && gameData.play_time) patch.play_time = gameData.play_time;
              if (!(existing as any).game_type && gameData.game_type) patch.game_type = gameData.game_type;
              // Patch expansion status from BGG (authoritative source)
              if (gameData.is_expansion && !(existing as any).is_expansion) {
                patch.is_expansion = true;
              }

              // Patch parent_game_id for expansions that weren't linked before
              if (!(existing as any).parent_game_id && (gameData.is_expansion || (existing as any).is_expansion)) {
                // Try explicit parent_game from CSV
                if (gameInput.parent_game) {
                  const { data: pg } = await supabaseAdmin
                    .from("games")
                    .select("id")
                    .eq("title", gameInput.parent_game)
                    .eq("library_id", targetLibraryId)
                    .maybeSingle();
                  if (pg) {
                    patch.parent_game_id = pg.id;
                    console.log(`[BulkImport] Linked existing expansion "${gameData.title}" → "${gameInput.parent_game}"`);
                  }
                }
              }

              // Patch bgg_id if we resolved one via title search
              if (!(existing as any).bgg_id && gameData.bgg_id) {
                patch.bgg_id = gameData.bgg_id;
                if (gameData.bgg_url) patch.bgg_url = gameData.bgg_url;
              }

              // Handle publisher for existing games missing one
              if (!(existing as any).publisher_id && gameData.publisher) {
                const { data: ep } = await supabaseAdmin
                  .from("publishers")
                  .select("id")
                  .eq("name", gameData.publisher)
                  .maybeSingle();
                if (ep) {
                  patch.publisher_id = ep.id;
                } else {
                  const { data: np } = await supabaseAdmin
                    .from("publishers")
                    .insert({ name: gameData.publisher })
                    .select("id")
                    .single();
                  if (np) patch.publisher_id = np.id;
                }
              }

              // Handle mechanics for existing games (add missing ones)
              if (gameData.mechanics?.length) {
                const { data: existingMechanics } = await supabaseAdmin
                  .from("game_mechanics")
                  .select("mechanic_id")
                  .eq("game_id", existing.id);

                if (!existingMechanics || existingMechanics.length === 0) {
                  const mechanicIds: string[] = [];
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
                  if (mechanicIds.length > 0) {
                    await supabaseAdmin.from("game_mechanics").insert(
                      mechanicIds.map(mid => ({ game_id: existing.id, mechanic_id: mid }))
                    );
                  }
                }
              }

              if (Object.keys(patch).length > 0) {
                const { error: updateErr } = await supabaseAdmin
                  .from("games")
                  .update(patch)
                  .eq("id", existing.id);

                if (updateErr) {
                  console.warn(`[BulkImport] Failed updating existing data for "${gameData.title}":`, updateErr);
                } else {
                  updated++;
                  const patchedFields = Object.keys(patch).join(", ");
                  console.log(`[BulkImport] Updated existing game "${gameData.title}" (patched: ${patchedFields})`);
                  continue;
                }
              }

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
                image_url: (() => {
                  const normalized = normalizeImageUrl(gameData.image_url);
                  // Reject low-quality BGG images at insert time - let the client image proxy handle display
                  if (isLowQualityBggImageUrl(normalized)) {
                    console.log(`[BulkImport] Rejecting low-quality image at insert for "${gameData.title}": ${normalized}`);
                    return null;
                  }
                  return normalized || null;
                })(),
                additional_images: gameData.additional_images?.length
                  ? (gameData.additional_images.map((u) => normalizeImageUrl(u)).filter(Boolean) as string[])
                  : null,
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
                copies_owned: (gameInput as any).copies_owned ?? 1,
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

        // Post-import: Link expansions to parent games (single combined pass)
        // Step 1: Title-matching (instant, no API calls)
        // Step 2: AI-powered detection for remaining unlinked games
        console.log(`[BulkImport] Post-import: Linking expansions...`);
        
        sendProgress({
          type: "progress",
          current: totalGames,
          total: totalGames,
          imported,
          failed,
          currentGame: "Linking expansions to base games...",
          phase: "linking_expansions",
        });

        const { data: allLibGames } = await supabaseAdmin
          .from("games")
          .select("id, title, is_expansion, parent_game_id")
          .eq("library_id", targetLibraryId);

        if (allLibGames && allLibGames.length > 1) {
          const baseGames = allLibGames.filter(g => !g.is_expansion && !g.parent_game_id);
          const sortedBases = [...baseGames].sort((a, b) => b.title.length - a.title.length);
          
          let titleLinked = 0;

          // --- Title-matching pass (covers "Age of Steam: XYZ" → "Age of Steam") ---
          for (const game of allLibGames) {
            // Process both BGG-flagged expansions without parent AND non-expansion games
            if (game.parent_game_id) continue;
            
            for (const baseGame of sortedBases) {
              if (game.id === baseGame.id) continue;
              if (baseGame.title.length < 3) continue;
              
              if (game.title.toLowerCase().startsWith(baseGame.title.toLowerCase())) {
                const afterBase = game.title.substring(baseGame.title.length).trim();
                if (afterBase.match(/^[–:\-–—]/) && afterBase.replace(/^[–:\-–—]\s*/, "").trim().length > 0) {
                  const { error: updateErr } = await supabaseAdmin
                    .from("games")
                    .update({ is_expansion: true, parent_game_id: baseGame.id })
                    .eq("id", game.id);
                  
                  if (!updateErr) {
                    titleLinked++;
                    console.log(`[BulkImport] Title-linked expansion "${game.title}" → "${baseGame.title}"`);
                  }
                  break;
                }
              }
            }
          }
          console.log(`[BulkImport] Title-matching linked ${titleLinked} expansions`);

          // --- AI pass for remaining unlinked expansions ---
          // Re-fetch to get updated parent_game_id values after title matching
          const { data: remainingGames } = await supabaseAdmin
            .from("games")
            .select("id, title, is_expansion, parent_game_id")
            .eq("library_id", targetLibraryId);

          if (remainingGames && isAIConfigured()) {
            const unlinkedExpansions = remainingGames.filter(g => g.is_expansion && !g.parent_game_id);
            const currentBases = remainingGames.filter(g => !g.is_expansion && !g.parent_game_id);

            if (unlinkedExpansions.length > 0 && currentBases.length > 0) {
              console.log(`[BulkImport] AI expansion detection: ${unlinkedExpansions.length} unlinked expansions, ${currentBases.length} base games`);

              // Batch in groups of 30 to stay within token limits
              const batchSize = 30;
              let aiLinked = 0;

              for (let bi = 0; bi < unlinkedExpansions.length; bi += batchSize) {
                const batch = unlinkedExpansions.slice(bi, bi + batchSize);
                const expansionList = batch.map((g, idx) => `E${idx}: ${g.title}`).join("\n");
                const baseList = currentBases.map((g, idx) => `B${idx}: ${g.title}`).join("\n");

                try {
                  const aiResult = await aiComplete({
                    messages: [
                      {
                        role: "system",
                        content: `You are a board game expert. Match expansions to their base games.

Given a list of EXPANSIONS and BASE GAMES, output a JSON object: { "matches": [ {"expansion_index": 0, "base_index": 2}, ... ] }

Rules:
- Only include matches you are confident about (>90% sure)
- "Age of Steam: 1830s Pennsylvania" is an expansion of "Age of Steam"
- "Catan: Seafarers" is an expansion of "Catan"
- Don't match games that are unrelated standalone games
- If unsure, skip it
- Output ONLY valid JSON, no explanation`,
                      },
                      {
                        role: "user",
                        content: `EXPANSIONS:\n${expansionList}\n\nBASE GAMES:\n${baseList}`,
                      },
                    ],
                    max_tokens: 2000,
                  });

                  if (aiResult.success && aiResult.content) {
                    try {
                      // Extract JSON from response (handle markdown code blocks)
                      const jsonStr = aiResult.content.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
                      const parsed = JSON.parse(jsonStr);
                      const matches = parsed.matches || parsed;

                      if (Array.isArray(matches)) {
                        for (const match of matches) {
                          const expIdx = match.expansion_index ?? match.e;
                          const baseIdx = match.base_index ?? match.b;
                          if (typeof expIdx !== "number" || typeof baseIdx !== "number") continue;
                          if (expIdx < 0 || expIdx >= batch.length) continue;
                          if (baseIdx < 0 || baseIdx >= currentBases.length) continue;

                          const expansion = batch[expIdx];
                          const base = currentBases[baseIdx];

                          const { error: linkErr } = await supabaseAdmin
                            .from("games")
                            .update({ parent_game_id: base.id })
                            .eq("id", expansion.id);

                          if (!linkErr) {
                            aiLinked++;
                            console.log(`[BulkImport] AI-linked expansion "${expansion.title}" → "${base.title}"`);
                          }
                        }
                      }
                    } catch (parseErr) {
                      console.warn(`[BulkImport] AI expansion response parse error:`, parseErr);
                    }
                  }
                } catch (aiErr) {
                  console.warn(`[BulkImport] AI expansion detection failed for batch:`, aiErr);
                }
              }
              console.log(`[BulkImport] AI-linked ${aiLinked} additional expansions`);
            }
          }
        }

        // Post-import: Import play history from CSV (BG Stats format)
        let playsImported = 0;
        let playsSkipped = 0;
        let playsFailed = 0;

        if (playLogRows.length > 0) {
          console.log(`[BulkImport] Fourth pass: Importing ${playLogRows.length} play log entries...`);
          sendProgress({
            type: "progress",
            current: totalGames,
            total: totalGames,
            imported,
            failed,
            currentGame: `Importing ${playLogRows.length} play sessions...`,
            phase: "importing_plays",
          });

          // Build a map of bgg_id → game_id for this library
          const { data: libraryGames } = await supabaseAdmin
            .from("games")
            .select("id, bgg_id")
            .eq("library_id", targetLibraryId)
            .not("bgg_id", "is", null);

          const bggIdToGameId = new Map<string, string>();
          if (libraryGames) {
            for (const g of libraryGames) {
              if (g.bgg_id) bggIdToGameId.set(g.bgg_id, g.id);
            }
          }

          // Group play rows to batch insert
          const sessionsToInsert: { game_id: string; played_at: string; notes: string }[] = [];

          for (const play of playLogRows) {
            const gameId = bggIdToGameId.get(play.bgg_id);
            if (!gameId) {
              playsSkipped++;
              console.log(`[BulkImport] Play skipped: no game found for BGG ID ${play.bgg_id} ("${play.title}")`);
              continue;
            }

            // Each row = 1 play (the "plays" field in BG Stats is always 1 per row)
            sessionsToInsert.push({
              game_id: gameId,
              played_at: `${play.play_date}T12:00:00Z`,
              notes: "Imported from CSV",
            });
          }

          console.log(`[BulkImport] Play sessions to insert: ${sessionsToInsert.length} (skipped ${playsSkipped} with no matching game)`);

          // Batch insert in chunks of 100
          const chunkSize = 100;
          for (let i = 0; i < sessionsToInsert.length; i += chunkSize) {
            const chunk = sessionsToInsert.slice(i, i + chunkSize);
            const { data: inserted, error: insertErr } = await supabaseAdmin
              .from("game_sessions")
              .insert(chunk)
              .select("id");

            if (insertErr) {
              console.error(`[BulkImport] Play session batch insert error:`, insertErr);
              playsFailed += chunk.length;
            } else {
              playsImported += inserted?.length || 0;
            }
          }

          console.log(`[BulkImport] Play history: imported=${playsImported} skipped=${playsSkipped} failed=${playsFailed}`);
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
          `[BulkImport] Complete: imported=${imported} updated=${updated} failed=${failed} plays=${playsImported} breakdown=${JSON.stringify(failureBreakdown)}`
        );

        sendProgress({
          type: "complete",
          success: true,
          imported,
          updated,
          failed,
          // Keep payload small for SSE, but give enough info for debugging.
          errors: errors.slice(0, 50),
          failureBreakdown,
          errorSummary,
          games: importedGames,
          // Play history stats from CSV import
          playHistory: playLogRows.length > 0 ? {
            imported: playsImported,
            skipped: playsSkipped,
            failed: playsFailed,
            totalRows: playLogRows.length,
          } : undefined,
          debug: {
            ...debug,
            debug_version: "bulk-import-2026-02-10",
            bgg_xml_attempts: bggXmlAttempts,
            bgg_xml_with_image: bggXmlWithImage,
            ai_enrich_attempts: aiEnrichAttempts,
            gallery_attempts: galleryAttempts,
            gallery_with_images: galleryWithImages,
          },
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
// Guard so this module can be imported by the self-hosted main router.
if (import.meta.main) {
  Deno.serve(handler);
}
