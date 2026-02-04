import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiComplete, isAIConfigured, getAIProviderName } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

type ImportMode = "csv" | "bgg_collection" | "bgg_links";

type BulkImportRequest = {
  mode: ImportMode;
  library_id?: string;
  csv_data?: string;
  bgg_username?: string;
  bgg_links?: string[];
  enhance_with_bgg?: boolean;
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
    const searchUrl = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(title)}&type=boardgame&exact=1`;
    const searchRes = await fetch(searchUrl);
    
    if (!searchRes.ok) {
      const fuzzyUrl = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(title)}&type=boardgame`;
      const fuzzyRes = await fetch(fuzzyUrl);
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

// Fetch full BGG data using Firecrawl + AI
async function fetchBGGData(
  bggId: string,
  firecrawlKey: string
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
  
  try {
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
    
    if (!scrapeRes.ok) return { bgg_id: bggId };

    // Defensive JSON parsing: Firecrawl can occasionally return an empty/truncated
    // body (network hiccup, proxy reset, rate limiting) which would otherwise crash
    // the whole import with `Unexpected end of JSON input`.
    let scrapeData: any;
    try {
      const raw = await scrapeRes.text();
      if (!raw || raw.trim().length === 0) {
        console.warn("[BulkImport] Firecrawl returned empty body for", pageUrl);
        return { bgg_id: bggId };
      }
      scrapeData = JSON.parse(raw);
    } catch (e) {
      console.warn("[BulkImport] Firecrawl returned invalid JSON for", pageUrl, e);
      return { bgg_id: bggId };
    }
    const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
    const rawHtml = scrapeData.data?.rawHtml || scrapeData.rawHtml || "";
    
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
    
    if (!isAIConfigured()) {
      return { bgg_id: bggId, image_url: mainImage ?? undefined };
    }
    
    console.log(`Using AI provider for extraction: ${getAIProviderName()}`);

    // aiComplete can occasionally throw if the upstream provider returns an empty/truncated
    // body (seen as `Unexpected end of JSON input`). Never let that crash the whole import.
    let aiResult:
      | {
          success: boolean;
          error?: string;
          toolCallArguments?: unknown;
        }
      | undefined;

    try {
      aiResult = await aiComplete({
        messages: [
          {
            role: "system",
            content: `You are a board game data extraction expert. Extract detailed, structured game information from the provided content.

IMPORTANT RULES:

1. For enum fields, you MUST use these EXACT values:
   - difficulty: ${DIFFICULTY_LEVELS.map(d => `"${d}"`).join(", ")}
   - play_time: ${PLAY_TIME_OPTIONS.map(p => `"${p}"`).join(", ")}
   - game_type: ${GAME_TYPE_OPTIONS.map(t => `"${t}"`).join(", ")}

2. For the DESCRIPTION field, create a COMPREHENSIVE description that includes:
   - An engaging overview paragraph about the game
   - A "## Quick Gameplay Overview" section with:
     - **Goal:** What players are trying to achieve
     - **On Your Turn:** The main actions players can take
     - **Scoring:** How points are earned
     - **End Game:** When and how the game ends
   
   Use markdown formatting. Aim for 200-400 words.

3. For mechanics, extract actual game mechanics (e.g., "Worker Placement", "Set Collection", "Dice Rolling").

4. For publisher, extract the publisher company name.`,
          },
          {
            role: "user",
            content: `Extract comprehensive board game data from this BoardGameGeek page content:

${markdown.slice(0, 15000)}`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_game",
            description: "Extract structured board game data including a detailed description",
            parameters: {
              type: "object",
              properties: {
                description: {
                  type: "string",
                  description: "Comprehensive game description with markdown formatting. Include overview, Quick Gameplay Overview section, and key details. Aim for 200-400 words."
                },
                difficulty: { type: "string", enum: DIFFICULTY_LEVELS },
                play_time: { type: "string", enum: PLAY_TIME_OPTIONS },
                game_type: { type: "string", enum: GAME_TYPE_OPTIONS },
                min_players: { type: "number" },
                max_players: { type: "number" },
                suggested_age: { type: "string" },
                mechanics: { type: "array", items: { type: "string" } },
                publisher: { type: "string" },
              },
              required: ["description"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_game" } },
      });
    } catch (e) {
      console.warn(
        "[BulkImport] AI extraction threw (skipping enrichment) for",
        pageUrl,
        e
      );
      return { bgg_id: bggId, image_url: mainImage ?? undefined };
    }
    
    if (!aiResult?.success || !aiResult.toolCallArguments) {
      console.error("AI extraction failed:", aiResult.error);
      return { bgg_id: bggId, image_url: mainImage ?? undefined };
    }
    
    const extractedData = aiResult.toolCallArguments as Record<string, unknown>;
    console.log(`Extracted description length: ${(extractedData.description as string)?.length || 0} chars`);
    
    return {
      bgg_id: bggId,
      image_url: mainImage || undefined,
      description: extractedData.description as string | undefined,
      difficulty: extractedData.difficulty as string | undefined,
      play_time: extractedData.play_time as string | undefined,
      game_type: extractedData.game_type as string | undefined,
      min_players: extractedData.min_players as number | undefined,
      max_players: extractedData.max_players as number | undefined,
      suggested_age: extractedData.suggested_age as string | undefined,
      mechanics: extractedData.mechanics as string[] | undefined,
      publisher: extractedData.publisher as string | undefined,
    };
  } catch (e) {
    console.error("fetchBGGData error:", e);
    return { bgg_id: bggId };
  }
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

const buildDescription = (description: string | undefined, privateComment: string | undefined): string | undefined => {
  const desc = description?.trim();
  const notes = privateComment?.trim();
  if (!desc && !notes) return undefined;
  if (!notes) return desc;
  if (!desc) return `**Notes:** ${notes}`;
  return `${desc}\n\n**Notes:** ${notes}`;
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

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
    const { mode, library_id, csv_data, bgg_username, bgg_links, enhance_with_bgg, default_options } = body;

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
          
          const gameData: GameToImport = { 
            title,
            bgg_id: bggId,
            bgg_url: bggId ? `https://boardgamegeek.com/boardgame/${bggId}` : (row.bgg_url || row["bgg url"] || row.url || undefined),
            type: row.type || row["game type"] || undefined,
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
            description: buildDescription(row.description, row.privatecomment),
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
    console.log(`Processing ${totalGames} games...`);

    // Create import job
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
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create import job" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jobId = job.id;

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

        // Send initial progress
        sendProgress({ 
          type: "start", 
          jobId, 
          total: totalGames 
        });

        // Process each game
        for (let i = 0; i < gamesToImport.length; i++) {
          const gameInput = gamesToImport[i];
          
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
              phase: enhance_with_bgg && firecrawlKey ? "enhancing" : "importing"
            });

            // BGG enhancement
            if (gameInput.bgg_id && enhance_with_bgg && firecrawlKey) {
              console.log(`Enhancing with BGG data: ${gameInput.bgg_id}`);
              let bggData: Awaited<ReturnType<typeof fetchBGGData>> | null = null;
              try {
                bggData = await fetchBGGData(gameInput.bgg_id, firecrawlKey);
              } catch (e) {
                console.warn(
                  "[BulkImport] fetchBGGData threw (skipping enrichment) for",
                  gameInput.bgg_id,
                  e
                );
                bggData = null;
              }
              if (bggData) {
                // Helper to check if a value is "empty" (undefined, null, or empty string)
                const isEmpty = (val: unknown): boolean => val === undefined || val === null || val === "";
                
                // Merge BGG data with CSV data - prefer CSV values when present and non-empty, fall back to BGG
                // IMPORTANT: For descriptions especially, BGG CSV exports do NOT include descriptions,
                // so we need to pull them from BGG page scraping
                gameData = {
                  ...bggData,
                  ...gameData,
                  // Explicitly handle fields where we want BGG data as fallback when CSV is empty
                  bgg_id: gameData.bgg_id || bggData.bgg_id,
                  image_url: isEmpty(gameData.image_url) ? bggData.image_url : gameData.image_url,
                  description: isEmpty(gameData.description) ? bggData.description : gameData.description,
                  difficulty: isEmpty(gameData.difficulty) ? bggData.difficulty : gameData.difficulty,
                  play_time: isEmpty(gameData.play_time) ? bggData.play_time : gameData.play_time,
                  game_type: isEmpty(gameData.game_type) ? bggData.game_type : gameData.game_type,
                  min_players: gameData.min_players ?? bggData.min_players,
                  max_players: gameData.max_players ?? bggData.max_players,
                  suggested_age: isEmpty(gameData.suggested_age) ? bggData.suggested_age : gameData.suggested_age,
                  mechanics: gameData.mechanics?.length ? gameData.mechanics : bggData.mechanics,
                  publisher: isEmpty(gameData.publisher) ? bggData.publisher : gameData.publisher,
                };
                
                console.log(`BGG merge for "${gameData.title}": description=${(gameData.description?.length || 0)} chars, bggDesc=${(bggData.description?.length || 0)} chars`);
                
                if (!gameData.title && gameInput.bgg_url) {
                  const pathParts = gameInput.bgg_url.split("/").filter(Boolean);
                  const slugPart = pathParts[pathParts.length - 1];
                  if (slugPart && !/^\d+$/.test(slugPart)) {
                    gameData.title = slugPart.replace(/-/g, " ").split(" ")
                      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(" ");
                  }
                }
              }
            } else if (enhance_with_bgg && firecrawlKey && gameData.title) {
              console.log(`Looking up BGG by title: ${gameData.title}`);
              let bggData: Awaited<ReturnType<typeof lookupBGGByTitle>> | null = null;
              try {
                bggData = await lookupBGGByTitle(gameData.title, firecrawlKey);
              } catch (e) {
                console.warn(
                  "[BulkImport] lookupBGGByTitle threw (skipping enrichment) for",
                  gameData.title,
                  e
                );
                bggData = null;
              }
              if (bggData) {
                // Merge BGG data with CSV data - prefer CSV values when present, fall back to BGG
                gameData = {
                  ...bggData,
                  ...gameData,
                  bgg_id: gameData.bgg_id || bggData.bgg_id,
                  image_url: gameData.image_url || bggData.image_url,
                  description: gameData.description || bggData.description,
                  difficulty: gameData.difficulty || bggData.difficulty,
                  play_time: gameData.play_time || bggData.play_time,
                  game_type: gameData.game_type || bggData.game_type,
                  min_players: gameData.min_players ?? bggData.min_players,
                  max_players: gameData.max_players ?? bggData.max_players,
                  suggested_age: gameData.suggested_age || bggData.suggested_age,
                  mechanics: gameData.mechanics?.length ? gameData.mechanics : bggData.mechanics,
                  publisher: gameData.publisher || bggData.publisher,
                };
              }
            }

            if (!gameData.title) {
              failed++;
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
                play_time: gameData.play_time || "45-60 Minutes",
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

            // Small delay to avoid rate limits
            if (enhance_with_bgg) {
              await new Promise(r => setTimeout(r, 300));
            }
          } catch (e) {
            console.error("Game import error:", e);
            failed++;
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
        sendProgress({ 
          type: "complete", 
          success: true,
          imported,
          failed,
          errors: errors.slice(0, 20),
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
