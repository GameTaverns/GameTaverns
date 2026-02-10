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

// ---------------------------------------------------------------------------
// BGG XML API Helper (fast, reliable)
// ---------------------------------------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Shared XML parsing logic
function parseBggXml(xml: string, bggId: string): {
  bgg_id: string;
  title?: string;
  image_url?: string;
  description?: string;
  min_players?: number;
  max_players?: number;
  suggested_age?: string;
  play_time?: string;
  difficulty?: string;
  mechanics?: string[];
  publisher?: string;
  is_expansion?: boolean;
} {
  if (!xml.includes("<item")) return { bgg_id: bggId };

  const titleMatch = xml.match(/<name[^>]*\btype="primary"[^>]*\bvalue="([^"]+)"/);
  const imageMatch = xml.match(/<image>([^<]+)<\/image>/);
  const descMatch = xml.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
  const minPlayersMatch = xml.match(/<minplayers[^>]*value="(\d+)"/);
  const maxPlayersMatch = xml.match(/<maxplayers[^>]*value="(\d+)"/);
  const minAgeMatch = xml.match(/<minage[^>]*value="(\d+)"/);
  const playTimeMatch = xml.match(/<playingtime[^>]*value="(\d+)"/);
  const weightMatch = xml.match(/<averageweight[^>]*value="([\d.]+)"/);
  const typeMatch = xml.match(/<item[^>]*type="([^"]+)"/);
  const mechanicsMatches = xml.matchAll(/<link[^>]*type="boardgamemechanic"[^>]*value="([^"]+)"/g);
  const mechanics = [...mechanicsMatches].map((m) => m[1]);
  const publisherMatch = xml.match(/<link[^>]*type="boardgamepublisher"[^>]*value="([^"]+)"/);

  let difficulty: string | undefined;
  if (weightMatch) {
    const w = parseFloat(weightMatch[1]);
    if (w > 0) {
      if (IS_SELF_HOSTED) {
        if (w < 1.5) difficulty = "1 - Very Easy";
        else if (w < 2.25) difficulty = "2 - Easy";
        else if (w < 3.0) difficulty = "3 - Medium";
        else if (w < 3.75) difficulty = "4 - Hard";
        else difficulty = "5 - Very Hard";
      } else {
        if (w < 1.5) difficulty = "1 - Light";
        else if (w < 2.25) difficulty = "2 - Medium Light";
        else if (w < 3.0) difficulty = "3 - Medium";
        else if (w < 3.75) difficulty = "4 - Medium Heavy";
        else difficulty = "5 - Heavy";
      }
    }
  }

  let play_time: string | undefined;
  if (playTimeMatch) {
    const minutes = parseInt(playTimeMatch[1], 10);
    if (IS_SELF_HOSTED) {
      if (minutes <= 30) play_time = "Under 30 Minutes";
      else if (minutes <= 45) play_time = "30-45 Minutes";
      else if (minutes <= 60) play_time = "45-60 Minutes";
      else if (minutes <= 90) play_time = "60-90 Minutes";
      else if (minutes <= 120) play_time = "90-120 Minutes";
      else if (minutes <= 180) play_time = "2-3 Hours";
      else play_time = "3+ Hours";
    } else {
      if (minutes <= 15) play_time = "0-15 Minutes";
      else if (minutes <= 30) play_time = "15-30 Minutes";
      else if (minutes <= 45) play_time = "30-45 Minutes";
      else if (minutes <= 60) play_time = "45-60 Minutes";
      else if (minutes <= 120) play_time = "60+ Minutes";
      else if (minutes <= 180) play_time = "2+ Hours";
      else play_time = "3+ Hours";
    }
  }

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
    if (description.length > 5000) description = description.slice(0, 5000);
  }

  const isExpansion = typeMatch?.[1] === "boardgameexpansion";

  console.log(`[GameImport] BGG XML extracted data for ${bggId} (desc=${description?.length || 0} chars, expansion=${isExpansion})`);

  return {
    bgg_id: bggId,
    title: titleMatch?.[1],
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
}

async function fetchBGGDataFromXML(
  bggId: string
): Promise<{
  bgg_id: string;
  title?: string;
  image_url?: string;
  description?: string;
  min_players?: number;
  max_players?: number;
  suggested_age?: string;
  play_time?: string;
  difficulty?: string;
  mechanics?: string[];
  publisher?: string;
  is_expansion?: boolean;
}> {
  const bggApiToken = Deno.env.get("BGG_API_TOKEN");
  const headers: Record<string, string> = { "User-Agent": "GameTaverns/1.0" };
  if (bggApiToken) headers["Authorization"] = bggApiToken;

  const xmlUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${bggId}&stats=1`;
  const maxAttempts = 6;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(xmlUrl, { headers });

      if (!res.ok) {
        // Always consume the response body to prevent Deno resource leaks
        await res.text().catch(() => {});
        console.warn(`[GameImport] BGG XML API returned ${res.status} for ${bggId}${!bggApiToken ? " (no BGG_API_TOKEN configured)" : ""}`);
        // If token caused a 401/403, retry without it
        if ((res.status === 401 || res.status === 403) && bggApiToken) {
          console.log(`[GameImport] Retrying BGG XML API without token for ${bggId}`);
          const retryRes = await fetch(xmlUrl, { headers: { "User-Agent": "GameTaverns/1.0" } });
          if (retryRes.ok) {
            const xml = await retryRes.text();
            if (xml.includes("<item")) {
              return parseBggXml(xml, bggId);
            }
            // Queued response — continue retrying
            if (attempt < maxAttempts) {
              console.log(`[GameImport] Tokenless retry got queued response, backing off (${attempt}/${maxAttempts})`);
              await sleep(Math.min(750 * attempt, 4000));
              continue;
            }
          } else {
            // Consume body to prevent leak
            await retryRes.text().catch(() => {});
            if (attempt < maxAttempts) {
              await sleep(Math.min(750 * attempt, 4000));
              continue;
            }
          }
        }
        // Retry on any non-ok status (including 202)
        if (attempt < maxAttempts) {
          console.log(`[GameImport] BGG API returned ${res.status}, retrying (${attempt}/${maxAttempts})`);
          await sleep(Math.min(750 * attempt, 4000));
          continue;
        }
        return { bgg_id: bggId };
      }

      const xml = await res.text();

      const retryable =
        xml.includes("Please try again later") ||
        xml.includes("Your request has been accepted") ||
        xml.includes("<message>") ||
        !xml.includes("<item");

      if (retryable && attempt < maxAttempts) {
        const backoffMs = Math.min(750 * attempt, 4000);
        console.log(`[GameImport] BGG XML not ready for ${bggId}, retrying (${attempt}/${maxAttempts}) in ${backoffMs}ms`);
        await sleep(backoffMs);
        continue;
      }

      return parseBggXml(xml, bggId);
    } catch (e) {
      console.error("[GameImport] BGG XML error:", e);
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

// ---------------------------------------------------------------------------
// Enum normalization helpers
// ---------------------------------------------------------------------------
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

// Export handler for self-hosted router
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's auth token to verify identity
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the user token (use getUser() for compatibility with self-hosted)
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) {
      console.error("[GameImport] Auth error:", userError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;

    // Create admin client with service role
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

    // Use .limit(1) instead of .maybeSingle() to avoid errors when user owns multiple libraries
    const { data: libraryRows } = await supabaseAdmin
      .from("libraries")
      .select("id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);

    const libraryData = libraryRows?.[0] || null;

    // Allow access if user is admin OR owns a library
    if (!roleData && !libraryData) {
      return new Response(
        JSON.stringify({ success: false, error: "You must own a library to import games" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { url, library_id, is_coming_soon, is_for_sale, sale_price, sale_condition, is_expansion, parent_game_id, location_room, location_shelf, location_misc, purchase_price, purchase_date, sleeved, upgraded_components, crowdfunded, inserts } = await req.json();

    // Determine which library to add the game to
    // If library_id is provided, use it; otherwise use the user's own library
    let targetLibraryId = library_id;
    if (!targetLibraryId && libraryData) {
      targetLibraryId = libraryData.id;
    }
    
    if (!targetLibraryId) {
      return new Response(
        JSON.stringify({ success: false, error: "No library specified and user has no library" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate input URL
    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate URL format
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("Invalid protocol");
      }
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid URL format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Importing game from URL:", url);

    // Extract BGG ID for validation and primary data source
    const bggIdMatch = url.match(/boardgame(?:expansion)?\/(\d+)/);
    const bggId = bggIdMatch?.[1];

    // ---------------------------------------------------------------------------
    // STEP 1: Try BGG XML API first (fast, ~0.5s, reliable descriptions)
    // ---------------------------------------------------------------------------
    let bggData: {
      bgg_id: string;
      title?: string;
      image_url?: string;
      description?: string;
      min_players?: number;
      max_players?: number;
      suggested_age?: string;
      play_time?: string;
      difficulty?: string;
      mechanics?: string[];
      publisher?: string;
      is_expansion?: boolean;
    } | null = null;

    if (bggId) {
      console.log("Fetching data from BGG XML API for:", bggId);
      bggData = await fetchBGGDataFromXML(bggId);
      
      if (bggData.title && bggData.description) {
        console.log(`BGG XML API returned complete data for ${bggData.title} (${bggData.description.length} chars)`);
      } else {
        console.log(`BGG XML API returned partial data for ${bggId}`);
      }
    }

    // ---------------------------------------------------------------------------
    // STEP 2: If BGG XML API provided complete data, use it directly (FAST PATH)
    // ---------------------------------------------------------------------------
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const hasCompleteData = bggData?.title && bggData?.description;

    if (hasCompleteData && bggData) {
      console.log("Using BGG XML API data directly (fast path)");

      // We have everything we need from the XML API
      // Skip Firecrawl and AI entirely for maximum speed
      
      // Handle mechanics
      let mechanicIds: string[] = [];
      if (bggData.mechanics && bggData.mechanics.length > 0) {
        for (const mechanicName of bggData.mechanics) {
          const { data: existingMechanic } = await supabaseAdmin
            .from("mechanics")
            .select("id")
            .eq("name", mechanicName)
            .maybeSingle();

          if (existingMechanic) {
            mechanicIds.push(existingMechanic.id);
          } else {
            const { data: newMechanic, error: mechError } = await supabaseAdmin
              .from("mechanics")
              .insert({ name: mechanicName })
              .select("id")
              .single();
            
            if (newMechanic && !mechError) {
              mechanicIds.push(newMechanic.id);
            }
          }
        }
      }

      // Handle publisher
      let publisherId: string | null = null;
      if (bggData.publisher) {
        const { data: existingPublisher } = await supabaseAdmin
          .from("publishers")
          .select("id")
          .eq("name", bggData.publisher)
          .maybeSingle();

        if (existingPublisher) {
          publisherId = existingPublisher.id;
        } else {
          const { data: newPublisher, error: pubError } = await supabaseAdmin
            .from("publishers")
            .insert({ name: bggData.publisher })
            .select("id")
            .single();
          
          if (newPublisher && !pubError) {
            publisherId = newPublisher.id;
          }
        }
      }

      // Handle expansion detection - try to find parent game
      let detectedParentGameId: string | null = null;
      const aiDetectedExpansion = bggData.is_expansion === true;
      
      if (aiDetectedExpansion && bggData.title) {
        const baseTitle = bggData.title.split(':')[0].trim();
        if (baseTitle && baseTitle !== bggData.title) {
          const { data: exactMatch } = await supabaseAdmin
            .from("games")
            .select("id, title")
            .eq("library_id", targetLibraryId)
            .eq("is_expansion", false)
            .ilike("title", baseTitle)
            .maybeSingle();

          if (exactMatch) {
            detectedParentGameId = exactMatch.id;
            console.log("Found parent game match:", exactMatch.title);
          }
        }
      }

      // Build game data
      const normalizedSaleCondition = normalizeSaleCondition(sale_condition);
      const gameData = {
        title: bggData.title!.slice(0, 500),
        description: bggData.description!.slice(0, 10000),
        image_url: bggData.image_url,
        additional_images: [],
        difficulty: bggData.difficulty || (IS_SELF_HOSTED ? "3 - Medium" : "3 - Medium"),
        game_type: "Board Game",
        play_time: bggData.play_time || (IS_SELF_HOSTED ? "45-60 Minutes" : "45-60 Minutes"),
        min_players: bggData.min_players || 1,
        max_players: bggData.max_players || 4,
        suggested_age: bggData.suggested_age || "10+",
        publisher_id: publisherId,
        bgg_id: bggId,
        bgg_url: url.includes("boardgamegeek.com") ? url : null,
        is_coming_soon: is_coming_soon === true,
        is_for_sale: is_for_sale === true,
        sale_price: is_for_sale === true && sale_price ? Number(sale_price) : null,
        sale_condition: is_for_sale === true ? normalizedSaleCondition : null,
        is_expansion: is_expansion === true || aiDetectedExpansion === true,
        parent_game_id: is_expansion === true ? parent_game_id : (aiDetectedExpansion ? detectedParentGameId : null),
        location_room: location_room || null,
        location_shelf: location_shelf || null,
        location_misc: location_misc || null,
        sleeved: sleeved === true,
        upgraded_components: upgraded_components === true,
        crowdfunded: crowdfunded === true,
        inserts: inserts === true,
        library_id: targetLibraryId,
      };

      // Upsert: if we already have a game for this BGG URL in this library, update it
      let existingId: string | null = null;
      if (gameData.bgg_url) {
        const { data: existing, error: existingError } = await supabaseAdmin
          .from("games")
          .select("id")
          .eq("bgg_url", gameData.bgg_url)
          .eq("library_id", targetLibraryId)
          .maybeSingle();
        if (existingError) throw existingError;
        existingId = existing?.id ?? null;
      }

      const write = existingId
        ? supabaseAdmin.from("games").update(gameData).eq("id", existingId).select().single()
        : supabaseAdmin.from("games").insert(gameData).select().single();

      const { data: game, error: gameError } = await write;

      if (gameError) {
        console.error("Game insert error:", gameError);
        throw gameError;
      }

      // Handle admin data
      const adminData = {
        game_id: game.id,
        purchase_price: purchase_price ? Number(purchase_price) : null,
        purchase_date: purchase_date || null,
      };
      await supabaseAdmin.from("game_admin_data").upsert(adminData, { onConflict: "game_id" });

      // Link mechanics
      if (mechanicIds.length > 0) {
        const mechanicLinks = mechanicIds.map((mechanicId) => ({
          game_id: game.id,
          mechanic_id: mechanicId,
        }));
        await supabaseAdmin.from("game_mechanics").insert(mechanicLinks);
      }

      console.log("Game imported successfully (fast path):", game.title);

      // Send Discord notification for NEW games only
      if (!existingId) {
        try {
          const playerCount = game.min_players && game.max_players
            ? `${game.min_players}-${game.max_players} players`
            : game.min_players
              ? `${game.min_players}+ players`
              : undefined;

          const discordPayload = {
            library_id: targetLibraryId,
            event_type: "game_added",
            data: {
              title: game.title,
              image_url: game.image_url,
              player_count: playerCount,
              play_time: game.play_time,
            },
          };

          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          
          console.log("Sending Discord notification for:", game.title);
          const notifyResponse = await fetch(`${supabaseUrl}/functions/v1/discord-notify`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(discordPayload),
          });
          
          if (notifyResponse.ok) {
            console.log("Discord notification sent successfully");
          } else {
            console.error("Discord notification failed:", await notifyResponse.text());
          }
        } catch (discordErr) {
          console.error("Discord notification error:", discordErr);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          game: {
            ...game,
            mechanics: bggData.mechanics || [],
            publisher: bggData.publisher || null,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------------------------------------------------------------------------
    // STEP 3: Fallback to Firecrawl + AI for non-BGG URLs or incomplete data
    // ---------------------------------------------------------------------------
    console.log("BGG XML API incomplete or non-BGG URL, falling back to Firecrawl + AI");
    
    if (!firecrawlKey) {
      // If no Firecrawl key and no complete BGG data, return what we have from BGG
      if (bggData?.title) {
        console.error("Firecrawl API key not configured, using partial BGG data");
        // Continue with partial data...
      } else {
        console.error("Firecrawl API key not configured and no BGG data available");
        return new Response(
          JSON.stringify({ success: false, error: "Import service temporarily unavailable. Please try again later." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log("Scraping with Firecrawl...");
    
    // Only scrape the main page - no gallery to avoid pulling irrelevant images
    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "rawHtml"],
        onlyMainContent: true,
      }),
    });

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      console.error("Firecrawl error:", scrapeResponse.status, errorText);
      
      // If we have partial BGG data, use it instead of failing entirely
      if (bggData?.title) {
        console.log("Firecrawl failed but BGG XML provided partial data, using that instead");
        // Build game with partial BGG data (same logic as fast path but with defaults)
        const normalizedSaleCondition = normalizeSaleCondition(sale_condition);
        const partialGameData = {
          title: bggData.title.slice(0, 500),
          description: bggData.description?.slice(0, 10000) || `${bggData.title} - imported from BoardGameGeek`,
          image_url: bggData.image_url || null,
          additional_images: [],
          difficulty: bggData.difficulty || (IS_SELF_HOSTED ? "3 - Medium" : "3 - Medium"),
          game_type: "Board Game" as const,
          play_time: bggData.play_time || (IS_SELF_HOSTED ? "45-60 Minutes" : "45-60 Minutes"),
          min_players: bggData.min_players || 1,
          max_players: bggData.max_players || 4,
          suggested_age: bggData.suggested_age || "10+",
          bgg_id: bggData.bgg_id,
          bgg_url: url,
          library_id: targetLibraryId,
          is_expansion: is_expansion === true || bggData.is_expansion === true,
          parent_game_id: parent_game_id || null,
          is_coming_soon: is_coming_soon === true,
          is_for_sale: is_for_sale === true,
          sale_price: is_for_sale ? sale_price || null : null,
          sale_condition: is_for_sale ? normalizedSaleCondition || null : null,
          location_room: location_room || null,
          location_shelf: location_shelf || null,
          location_misc: location_misc || null,
          sleeved: sleeved === true,
          upgraded_components: upgraded_components === true,
          crowdfunded: crowdfunded === true,
          inserts: inserts === true,
        };

        const { data: game, error: insertError } = await supabaseAdmin
          .from("games")
          .insert(partialGameData)
          .select()
          .single();

        if (insertError || !game) {
          console.error("Insert error (partial):", insertError?.message, insertError?.code, insertError?.details, insertError?.hint);
          return new Response(
            JSON.stringify({ success: false, error: insertError?.message || "Failed to save game" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Handle mechanics from BGG data
        if (bggData.mechanics && bggData.mechanics.length > 0) {
          for (const mechanicName of bggData.mechanics) {
            const { data: existingMechanic } = await supabaseAdmin
              .from("mechanics").select("id").eq("name", mechanicName).maybeSingle();
            const mechId = existingMechanic?.id;
            if (mechId) {
              await supabaseAdmin.from("game_mechanics").insert({ game_id: game.id, mechanic_id: mechId });
            } else {
              const { data: newMech } = await supabaseAdmin.from("mechanics").insert({ name: mechanicName }).select("id").single();
              if (newMech) await supabaseAdmin.from("game_mechanics").insert({ game_id: game.id, mechanic_id: newMech.id });
            }
          }
        }

        // Handle purchase data
        if (purchase_price || purchase_date) {
          await supabaseAdmin.from("game_admin_data").insert({
            game_id: game.id,
            purchase_price: purchase_price ? parseFloat(purchase_price) : null,
            purchase_date: purchase_date || null,
          });
        }

        return new Response(
          JSON.stringify({ success: true, game: { ...game, mechanics: bggData.mechanics || [], publisher: bggData.publisher || null } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: `Failed to scrape page: ${scrapeResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const scrapeData = await scrapeResponse.json();
    const markdown = scrapeData.data?.markdown || scrapeData.markdown;
    const rawHtml = scrapeData.data?.rawHtml || scrapeData.rawHtml || "";

    // Extract image URLs from the raw HTML (BGG uses cf.geekdo-images.com)
    // Only from main page - no gallery scraping to avoid irrelevant images
    const imageRegex = /https?:\/\/cf\.geekdo-images\.com[^\s"'<>]+/g;
    const allImageMatches = rawHtml.match(imageRegex) || [];
    
    // Deduplicate images
    const uniqueImages = [...new Set(allImageMatches)] as string[];
    
    // Filter out tiny thumbnails but allow various quality levels
    const filteredImages = uniqueImages.filter((img) => {
      // Exclude tiny thumbnails and avatars
      const isTiny = /crop100|square30|100x100|150x150|_thumb|_avatar|_micro/i.test(img);
      return !isTiny;
    });
    
    // Prioritize box art (_itemrep) first, then large images (_imagepage), then others
    const sortedImageLinks = filteredImages.sort((a, b) => {
      const getPriority = (url: string) => {
        if (/_itemrep/i.test(url)) return 0; // Box art - highest priority
        if (/_imagepage/i.test(url)) return 1; // Full-size photos
        if (/_original/i.test(url)) return 2; // Original uploads
        if (/\/pic\d+/i.test(url)) return 3; // Standard BGG image format
        return 4; // Other images
      };
      return getPriority(a) - getPriority(b);
    });
    
    // Take the first image as main (box art preferred), then additional images
    // Use BGG XML image if available, otherwise use scraped image
    const mainImage = bggData?.image_url || sortedImageLinks[0] || null;
    // Get up to 5 additional images (excluding the main one)
    const additionalScrapedImages = sortedImageLinks.slice(1, 6);

    if (!markdown) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not extract content from the page" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Scraped content length:", markdown.length);

    // Step 2: Use AI to extract structured game data
    if (!isAIConfigured()) {
      console.error("No AI provider configured (set PERPLEXITY_API_KEY or LOVABLE_API_KEY)");
      return new Response(
        JSON.stringify({ success: false, error: "AI service not configured. Set PERPLEXITY_API_KEY in your environment." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Extracting game data with AI using:", getAIProviderName());
    
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

2. For the DESCRIPTION field, create a CONCISE description that includes:
   - An engaging overview paragraph about the game (2-3 sentences max)
   - A "## Quick Gameplay Overview" section with BULLET POINTS:
     - **Goal:** One sentence about what players are trying to achieve
     - **Each Round:** or **On Your Turn:** Use bullet points with bold labels for key actions (keep each to one line)
     - **Final Round:** or **End Game:** One sentence about how the game ends
     - **Winner:** One sentence about victory condition
   - A brief closing sentence about what makes the game special (optional)
   
   Use markdown formatting with headers (##), bold (**text**), and bullet points.
   Keep it CONCISE - aim for 150-200 words maximum. Players should be able to scan and understand quickly.

3. For IMAGES:
   - For main_image: Use the FIRST image with "_itemrep" (box art) - this is the primary image
   - For gameplay_images: Include up to 3 high-quality component/gameplay photos (not duplicates of box art)

4. For mechanics, extract actual game mechanics (e.g., "Worker Placement", "Set Collection", "Dice Rolling").

5. For publisher, extract the publisher company name.

6. EXPANSION DETECTION - CRITICAL:
   - Look for indicators that this is an EXPANSION (not a standalone game):
     - The title contains words like "Expansion", "Promo", "Pack", "Mini Expansion", "Scenario", "Module"
     - The page explicitly says "Expansion for [Base Game Name]" or "Requires [Base Game Name]"
     - BoardGameGeek categorizes it as an expansion
   - If it's an expansion, set is_expansion to true
   - Extract the BASE GAME TITLE (exactly as it appears) into base_game_title field
   - Example: "Wingspan: European Expansion" → is_expansion: true, base_game_title: "Wingspan"

RESPOND WITH VALID JSON ONLY. Example format:
{
  "title": "Game Name",
  "description": "Description text...",
  "difficulty": "3 - Medium",
  "play_time": "45-60 Minutes",
  "game_type": "Board Game",
  "min_players": 2,
  "max_players": 4,
  "suggested_age": "10+",
  "mechanics": ["Worker Placement", "Set Collection"],
  "publisher": "Publisher Name",
  "main_image": "https://...",
  "gameplay_images": ["https://..."],
  "bgg_url": "https://boardgamegeek.com/...",
  "is_expansion": false,
  "base_game_title": null
}`,
        },
        {
          role: "user",
          content: `Extract comprehensive board game data from this page content.

TARGET PAGE (must match): ${url}

AVAILABLE IMAGES (use first _itemrep for main_image, others for gameplay_images):
Main: ${mainImage || "No main image found"}
Additional: ${additionalScrapedImages.slice(0, 3).join(", ") || "None"}

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
                  description: "Concise game description with markdown formatting. Include brief overview, Quick Gameplay Overview section with bullet points for Goal/Actions/End Game/Winner. Keep to 150-200 words max." 
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
                main_image: { type: "string", description: "Primary box art/cover image URL - the main, high-quality game image" },
                gameplay_images: { 
                  type: "array", 
                  items: { type: "string" },
                  description: "1-2 gameplay/component images only. No thumbnails, no duplicates of main image." 
                },
                bgg_url: { type: "string", description: "BoardGameGeek URL if available" },
                is_expansion: { type: "boolean", description: "True if this is an expansion/promo/pack that requires a base game" },
                base_game_title: { type: "string", description: "If is_expansion is true, the exact title of the base game this expands (e.g., 'Wingspan' for 'Wingspan: European Expansion')" },
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
      
      if (aiResult.rateLimited) {
        return new Response(
          JSON.stringify({ success: false, error: "Service temporarily busy. Please try again in a moment." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "Failed to extract game data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("AI result:", JSON.stringify(aiResult, null, 2));

    // Define expected structure for extracted data
    interface ExtractedGameData {
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
      main_image?: string;
      image_url?: string;
      gameplay_images?: string[];
      additional_images?: string[];
      bgg_url?: string;
      is_expansion?: boolean;
      base_game_title?: string;
    }

    // Extract data from tool call or parse from content
    let extractedData: ExtractedGameData;
    
    if (aiResult.toolCallArguments) {
      extractedData = aiResult.toolCallArguments as ExtractedGameData;
    } else if (aiResult.content) {
      // Try to parse JSON from content (for providers that don't support tools)
      try {
        // Find JSON in the response
        const jsonMatch = aiResult.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]) as ExtractedGameData;
        } else {
          throw new Error("No JSON found in response");
        }
      } catch (parseErr) {
        console.error("Failed to parse AI content as JSON:", parseErr);
        return new Response(
          JSON.stringify({ success: false, error: "Could not parse game data from page" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Could not parse game data from page" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Extracted data:", JSON.stringify(extractedData, null, 2));

    if (!extractedData.title) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not find game title on the page" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Handle mechanics - find or create
    let mechanicIds: string[] = [];
    if (extractedData.mechanics && extractedData.mechanics.length > 0) {
      for (const mechanicName of extractedData.mechanics) {
        // Check if mechanic exists
        const { data: existingMechanic } = await supabaseAdmin
          .from("mechanics")
          .select("id")
          .eq("name", mechanicName)
          .maybeSingle();

        if (existingMechanic) {
          mechanicIds.push(existingMechanic.id);
        } else {
          // Create new mechanic
          const { data: newMechanic, error: mechError } = await supabaseAdmin
            .from("mechanics")
            .insert({ name: mechanicName })
            .select("id")
            .single();
          
          if (newMechanic && !mechError) {
            mechanicIds.push(newMechanic.id);
          }
        }
      }
    }

    // Step 4: Handle publisher - find or create
    let publisherId: string | null = null;
    if (extractedData.publisher) {
      const { data: existingPublisher } = await supabaseAdmin
        .from("publishers")
        .select("id")
        .eq("name", extractedData.publisher)
        .maybeSingle();

      if (existingPublisher) {
        publisherId = existingPublisher.id;
      } else {
        const { data: newPublisher, error: pubError } = await supabaseAdmin
          .from("publishers")
          .insert({ name: extractedData.publisher })
          .select("id")
          .single();
        
        if (newPublisher && !pubError) {
          publisherId = newPublisher.id;
        }
      }
    }

    // Step 4b: Handle expansion detection - try to find parent game in this library
    let detectedParentGameId: string | null = null;
    const aiDetectedExpansion = extractedData.is_expansion === true;
    const aiBaseGameTitle = extractedData.base_game_title;

    if (aiDetectedExpansion && aiBaseGameTitle) {
      console.log("AI detected expansion for base game:", aiBaseGameTitle);
      
      // Try exact match first
      const { data: exactMatch } = await supabaseAdmin
        .from("games")
        .select("id, title")
        .eq("library_id", targetLibraryId)
        .eq("is_expansion", false)
        .ilike("title", aiBaseGameTitle)
        .maybeSingle();

      if (exactMatch) {
        detectedParentGameId = exactMatch.id;
        console.log("Found exact parent game match:", exactMatch.title);
      } else {
        // Try fuzzy match - the base game title might be slightly different
        const { data: fuzzyMatches } = await supabaseAdmin
          .from("games")
          .select("id, title")
          .eq("library_id", targetLibraryId)
          .eq("is_expansion", false)
          .ilike("title", `%${aiBaseGameTitle.split(':')[0].trim()}%`)
          .limit(5);

        if (fuzzyMatches && fuzzyMatches.length === 1) {
          detectedParentGameId = fuzzyMatches[0].id;
          console.log("Found fuzzy parent game match:", fuzzyMatches[0].title);
        } else if (fuzzyMatches && fuzzyMatches.length > 1) {
          console.log("Multiple potential parent games found, skipping auto-link:", fuzzyMatches.map(g => g.title));
        }
      }
    }

    // Step 5: Create the game
    // BGG/Geekdo image URLs sometimes include characters like parentheses in filters (e.g. no_upscale())
    // which can cause HTTP 400 unless properly URL-encoded.
    // Also cleans up malformed URLs from HTML scraping (e.g., &quot;); trailing garbage)
    const sanitizeImageUrl = (imageUrl: string): string => {
      // First, clean malformed URL junk from HTML scraping
      let cleaned = imageUrl
        .replace(/&quot;.*$/i, "")       // Remove &quot; and everything after
        .replace(/["');}\s]+$/g, "")     // Remove trailing quotes, parens, brackets, whitespace
        .replace(/%22.*$/i, "")          // Remove encoded quote and everything after
        .replace(/[\r\n\t]+/g, "")       // Remove any newlines/tabs
        .trim();
      
      if (!cleaned) return imageUrl;
      
      try {
        const u = new URL(cleaned);
        // Ensure special characters are encoded (notably parentheses)
        u.pathname = u.pathname.replace(/\(/g, "%28").replace(/\)/g, "%29");
        // Preserve already-encoded values; URL will normalize safely
        return u.toString();
      } catch {
        return cleaned
          .replace(/\(/g, "%28")
          .replace(/\)/g, "%29");
      }
    };

    // NOTE: We intentionally do NOT try to "validate" image URLs server-side.
    // BGG's image CDN can reject server-side fetches (403/400) even though the same URLs load fine in the browser,
    // which would incorrectly strip images from imports.

    const filterGameplayImages = (images: string[] | undefined): string[] => {
      if (!images || !Array.isArray(images)) return [];

      const filtered = images
        .map((img) => sanitizeImageUrl(img))
        .filter((img) => {
          if (!img || typeof img !== "string") return false;
          // Exclude thumbnails / low-res
          if (/crop100|square30|100x100|150x150|200x200|300x300|thumb/i.test(img)) return false;
          // Don't treat box-art representations as gameplay images
          if (/_itemrep/i.test(img)) return false;
          return true;
        });

      // Deduplicate & limit
      return [...new Set(filtered)].slice(0, 2);
    };

    // Main image (box art) - just sanitize/encode
    const mainImageCandidateRaw = extractedData.main_image || extractedData.image_url;
    const validMainImage: string | null = mainImageCandidateRaw
      ? sanitizeImageUrl(mainImageCandidateRaw)
      : null;

    // Gameplay images - sanitize, filter, ensure not duplicate of main
    const gameplayCandidates = extractedData.gameplay_images || extractedData.additional_images;
    let validGameplayImages = filterGameplayImages(gameplayCandidates);

    // Fallback: if AI didn't pick gameplay images, use the pre-scraped additional images
    if (validGameplayImages.length === 0 && additionalScrapedImages && additionalScrapedImages.length > 0) {
      const fallbackGameplay = additionalScrapedImages
        .filter((img) => {
          if (!img || typeof img !== "string") return false;
          // Exclude tiny thumbnails
          if (/crop100|square30|100x100|150x150|200x200|300x300|thumb/i.test(img)) return false;
          return true;
        })
        .map((img) => sanitizeImageUrl(img));

      validGameplayImages = [...new Set(fallbackGameplay)].slice(0, 5);
    }

    if (validMainImage) validGameplayImages = validGameplayImages.filter((u) => u !== validMainImage);

    // Game data for games table (without admin fields like purchase_price/purchase_date)
    // Normalize enum values to match the current environment's database schema
    const normalizedDifficulty = normalizeDifficulty(extractedData.difficulty) || (IS_SELF_HOSTED ? "3 - Medium" : "3 - Medium");
    const normalizedGameType = normalizeGameType(extractedData.game_type) || "Board Game";
    const normalizedPlayTime = normalizePlayTime(extractedData.play_time) || (IS_SELF_HOSTED ? "45-60 Minutes" : "45-60 Minutes");
    const normalizedSaleCondition = normalizeSaleCondition(sale_condition);

    const gameData = {
      title: extractedData.title.slice(0, 500),
      description: extractedData.description?.slice(0, 10000) || null, // Increased limit for rich descriptions
      image_url: validMainImage,
      additional_images: validGameplayImages,
      difficulty: normalizedDifficulty,
      game_type: normalizedGameType,
      play_time: normalizedPlayTime,
      min_players: extractedData.min_players || 1,
      max_players: extractedData.max_players || 4,
      suggested_age: extractedData.suggested_age || "10+",
      publisher_id: publisherId,
      bgg_url: extractedData.bgg_url || (url.includes("boardgamegeek.com") ? url : null),
      is_coming_soon: is_coming_soon === true,
      is_for_sale: is_for_sale === true,
      sale_price: is_for_sale === true && sale_price ? Number(sale_price) : null,
      sale_condition: is_for_sale === true ? normalizedSaleCondition : null,
      // Use explicit is_expansion from request, OR auto-detect from AI
      is_expansion: is_expansion === true || aiDetectedExpansion === true,
      // Use explicit parent_game_id from request, OR auto-detected parent
      parent_game_id: is_expansion === true ? parent_game_id : (aiDetectedExpansion ? detectedParentGameId : null),
      location_room: location_room || null,
      location_shelf: location_shelf || null,
      location_misc: location_misc || null,
      sleeved: sleeved === true,
      upgraded_components: upgraded_components === true,
      crowdfunded: crowdfunded === true,
      inserts: inserts === true,
      library_id: targetLibraryId,
    };

    // Upsert: if we already have a game for this BGG URL in this library, update it instead of inserting a duplicate.
    let existingId: string | null = null;
    if (gameData.bgg_url) {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("games")
        .select("id")
        .eq("bgg_url", gameData.bgg_url)
        .eq("library_id", targetLibraryId)
        .maybeSingle();
      if (existingError) throw existingError;
      existingId = existing?.id ?? null;
    }

    const write = existingId
      ? supabaseAdmin.from("games").update(gameData).eq("id", existingId).select().single()
      : supabaseAdmin.from("games").insert(gameData).select().single();

    const { data: game, error: gameError } = await write;

    if (gameError) {
      console.error("Game insert error:", gameError);
      throw gameError;
    }

    // Step 6: Handle admin data (purchase_price, purchase_date) in game_admin_data table
    const adminData = {
      game_id: game.id,
      purchase_price: purchase_price ? Number(purchase_price) : null,
      purchase_date: purchase_date || null,
    };

    // Upsert admin data
    const { error: adminError } = await supabaseAdmin
      .from("game_admin_data")
      .upsert(adminData, { onConflict: "game_id" });

    if (adminError) {
      console.warn("Admin data insert warning:", adminError);
      // Don't fail the import for admin data issues
    }

    // Step 7: Link mechanics to game
    if (mechanicIds.length > 0) {
      const mechanicLinks = mechanicIds.map((mechanicId) => ({
        game_id: game.id,
        mechanic_id: mechanicId,
      }));

      await supabaseAdmin.from("game_mechanics").insert(mechanicLinks);
    }

    console.log("Game imported successfully:", game.title);

    // Step 8: Send Discord notification for NEW games only (not updates)
    if (!existingId) {
      try {
        const playerCount = game.min_players && game.max_players
          ? `${game.min_players}-${game.max_players} players`
          : game.min_players
            ? `${game.min_players}+ players`
            : undefined;

        const discordPayload = {
          library_id: targetLibraryId,
          event_type: "game_added",
          data: {
            title: game.title,
            image_url: game.image_url,
            player_count: playerCount,
            play_time: game.play_time,
          },
        };

        // Call discord-notify function - must await to prevent edge function from terminating early
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        
        console.log("Sending Discord notification for:", game.title);
        const notifyResponse = await fetch(`${supabaseUrl}/functions/v1/discord-notify`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(discordPayload),
        });
        
        if (notifyResponse.ok) {
          console.log("Discord notification sent successfully");
        } else {
          console.error("Discord notification failed:", await notifyResponse.text());
        }
      } catch (discordErr) {
        console.error("Discord notification error:", discordErr);
        // Don't fail the import for notification issues
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        game: {
          ...game,
          mechanics: extractedData.mechanics || [],
          publisher: extractedData.publisher || null,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Game import error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Import failed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// For Lovable Cloud deployment (direct function invocation)
// Guard so this module can be imported by the self-hosted main router.
if (import.meta.main) {
  Deno.serve(handler);
}
