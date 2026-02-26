import { createClient } from "npm:@supabase/supabase-js@2";
import { withLogging } from "../_shared/system-logger.ts";

// Helper to get allowed origins
const getAllowedOrigins = (): string[] => {
  const origins = [
    Deno.env.get("ALLOWED_ORIGIN") || "",
    "http://localhost:5173",
    "http://localhost:8080",
  ].filter(Boolean);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (supabaseUrl) {
    const projectMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (projectMatch) {
      origins.push(`https://${projectMatch[1]}.lovable.app`);
    }
  }

  return origins;
};

// Get CORS headers with origin validation
const getCorsHeaders = (requestOrigin: string | null): Record<string, string> => {
  const allowedOrigins = getAllowedOrigins();
  const isAllowedOrigin =
    requestOrigin &&
    (allowedOrigins.some((allowed) => requestOrigin === allowed) ||
      requestOrigin.endsWith(".lovable.app") ||
      requestOrigin.endsWith(".lovableproject.com"));

  const origin = isAllowedOrigin ? requestOrigin : allowedOrigins[0] || "*";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
};

interface BGGPlay {
  id: string;
  date: string;
  quantity: number;
  length: number | null;
  location: string | null;
  incomplete: boolean;
  nowinstats: boolean;
  comments: string | null;
  game: {
    objectid: string;
    name: string;
  };
  players: Array<{
    name: string;
    username?: string;
    userid?: string;
    startposition?: string;
    color?: string;
    score?: string;
    new: boolean;
    rating?: string;
    win: boolean;
  }>;
}

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
  details: {
    importedPlays: string[];
    updatedPlays: string[];
    skippedDuplicates: string[];
    unmatchedGames: string[];
    autoCreatedGames: string[];
  };
}

/**
 * Try to find a game in the catalog by BGG ID and create a "played_only" entry
 * in the user's library so play sessions can be logged against it.
 */
async function findOrCreatePlayedOnlyGame(
  supabaseAdmin: any,
  libraryId: string,
  bggId: string,
  gameName: string,
  gamesByBggId: Map<string, { id: string; title: string }>,
  gamesByTitle: Map<string, { id: string; title: string }>,
): Promise<{ id: string; title: string } | null> {
  // Look up the catalog by bgg_id
  const { data: catalogEntry } = await supabaseAdmin
    .from("game_catalog")
    .select("id, title, description, image_url, min_players, max_players, play_time_minutes, weight, suggested_age, is_expansion, bgg_id, bgg_url, slug")
    .eq("bgg_id", bggId)
    .maybeSingle();

  if (!catalogEntry) {
    console.log(`[BGGPlayImport] No catalog entry found for BGG ID ${bggId} (${gameName})`);
    return null;
  }

  // Map catalog play_time_minutes to the play_time enum
  let playTimeEnum = "45-60 Minutes";
  if (catalogEntry.play_time_minutes) {
    const m = catalogEntry.play_time_minutes;
    if (m <= 15) playTimeEnum = "0-15 Minutes";
    else if (m <= 30) playTimeEnum = "15-30 Minutes";
    else if (m <= 45) playTimeEnum = "30-45 Minutes";
    else if (m <= 60) playTimeEnum = "45-60 Minutes";
    else if (m <= 120) playTimeEnum = "60+ Minutes";
    else if (m <= 180) playTimeEnum = "2+ Hours";
    else playTimeEnum = "3+ Hours";
  }

  // Map weight to difficulty enum
  let difficultyEnum = "3 - Medium";
  if (catalogEntry.weight) {
    const w = catalogEntry.weight;
    if (w < 1.5) difficultyEnum = "1 - Light";
    else if (w < 2.5) difficultyEnum = "2 - Medium Light";
    else if (w < 3.5) difficultyEnum = "3 - Medium";
    else if (w < 4.5) difficultyEnum = "4 - Medium Heavy";
    else difficultyEnum = "5 - Heavy";
  }

  // Create the game in the library as "played_only"
  const { data: newGame, error: insertError } = await supabaseAdmin
    .from("games")
    .insert({
      library_id: libraryId,
      title: catalogEntry.title,
      description: catalogEntry.description,
      image_url: catalogEntry.image_url,
      min_players: catalogEntry.min_players || 1,
      max_players: catalogEntry.max_players || 4,
      play_time: playTimeEnum,
      difficulty: difficultyEnum,
      suggested_age: catalogEntry.suggested_age || "10+",
      is_expansion: catalogEntry.is_expansion || false,
      bgg_id: catalogEntry.bgg_id,
      bgg_url: catalogEntry.bgg_url,
      catalog_id: catalogEntry.id,
      ownership_status: "played_only",
    })
    .select("id, title")
    .single();

  if (insertError) {
    console.error(`[BGGPlayImport] Failed to create played_only game for ${gameName}:`, insertError.message);
    return null;
  }

  console.log(`[BGGPlayImport] Auto-created played_only game: "${newGame.title}" (${newGame.id})`);

  // Update lookup maps so subsequent plays for the same game don't re-create
  gamesByBggId.set(bggId, { id: newGame.id, title: newGame.title });
  gamesByTitle.set(newGame.title.toLowerCase(), { id: newGame.id, title: newGame.title });

  return { id: newGame.id, title: newGame.title };
}

// Parse BGG XML plays response
function parseBGGPlaysXML(xmlText: string): BGGPlay[] {
  const plays: BGGPlay[] = [];
  
  // Extract all <play> elements
  const playMatches = xmlText.matchAll(/<play\s+([^>]*)>([\s\S]*?)<\/play>/g);
  
  for (const match of playMatches) {
    const attrs = match[1];
    const content = match[2];
    
    // Parse play attributes
    const id = attrs.match(/id="(\d+)"/)?.[1] || "";
    const date = attrs.match(/date="([^"]+)"/)?.[1] || "";
    const quantity = parseInt(attrs.match(/quantity="(\d+)"/)?.[1] || "1", 10);
    const length = parseInt(attrs.match(/length="(\d+)"/)?.[1] || "0", 10) || null;
    const location = attrs.match(/location="([^"]*)"/)?.[1] || null;
    const incomplete = attrs.match(/incomplete="1"/) !== null;
    const nowinstats = attrs.match(/nowinstats="1"/) !== null;
    
    // Parse item (game)
    const itemMatch = content.match(/<item\s+([^>]*)\/?>(?:<\/item>)?/);
    if (!itemMatch) continue;
    
    const itemAttrs = itemMatch[1];
    const objectid = itemAttrs.match(/objectid="(\d+)"/)?.[1] || "";
    const name = itemAttrs.match(/name="([^"]+)"/)?.[1] || "";
    
    // Parse comments
    const commentsMatch = content.match(/<comments>([^<]*)<\/comments>/);
    const comments = commentsMatch?.[1] || null;
    
    // Parse players
    const players: BGGPlay["players"] = [];
    const playerMatches = content.matchAll(/<player\s+([^>]*)\/>/g);
    
    for (const playerMatch of playerMatches) {
      const playerAttrs = playerMatch[1];
      
      // Extract name - use word boundary to avoid matching "username" 
      const nameMatch = playerAttrs.match(/(?:^|\s)name="([^"]*)"/);
      const usernameMatch = playerAttrs.match(/username="([^"]*)"/);
      
      // Get the best available name
      const rawName = nameMatch?.[1] || "";
      const rawUsername = usernameMatch?.[1] || "";
      const playerName = rawName.trim() || rawUsername.trim() || "Unknown";
      
      // Debug log for first few plays to see what BGG returns
      if (players.length < 3) {
        console.log(`[BGGPlayImport] Player parse: rawName="${rawName}", rawUsername="${rawUsername}", final="${playerName}", attrs="${playerAttrs.slice(0, 200)}"`);
      }
      
      players.push({
        name: playerName,
        username: rawUsername,
        userid: playerAttrs.match(/userid="([^"]*)"/)?.[1],
        startposition: playerAttrs.match(/startposition="([^"]*)"/)?.[1],
        color: playerAttrs.match(/color="([^"]*)"/)?.[1],
        score: playerAttrs.match(/score="([^"]*)"/)?.[1],
        new: playerAttrs.match(/new="1"/) !== null,
        rating: playerAttrs.match(/rating="([^"]*)"/)?.[1],
        win: playerAttrs.match(/win="1"/) !== null,
      });
    }
    
    plays.push({
      id,
      date,
      quantity,
      length,
      location,
      incomplete,
      nowinstats,
      comments,
      game: { objectid, name },
      players,
    });
  }
  
  return plays;
}

// Fetch all plays from BGG (handles pagination)
async function fetchAllBGGPlays(username: string): Promise<BGGPlay[]> {
  const allPlays: BGGPlay[] = [];
  let page = 1;

  // Optional auth aids for BGG XML API access.
  // 1) Session cookie can help with anti-bot/rate limits.
  // 2) API token (if configured) can authenticate server requests.
  const rawCookie = Deno.env.get("BGG_SESSION_COOKIE") || Deno.env.get("BGG_COOKIE") || "";
  const bggApiToken = Deno.env.get("BGG_API_TOKEN") || "";

  // Extract the BGG username from cookie when present (e.g. "bggusername=tzolak").
  let cookieOwner = "";
  if (rawCookie) {
    const match = rawCookie.match(/bggusername=([^;]+)/i);
    cookieOwner = match ? match[1].trim().toLowerCase() : "";
  }

  const requestedUser = username.trim().toLowerCase();
  const cookiePairs = rawCookie
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  // If cookie owner matches requested username, use full cookie.
  // If it doesn't match, strip bggusername but keep remaining session cookies to avoid 401 mismatch.
  const sanitizedCookie = cookiePairs
    .filter((part) => !/^bggusername=/i.test(part))
    .join("; ");

  const requestCookie =
    rawCookie && cookieOwner && cookieOwner === requestedUser
      ? rawCookie
      : sanitizedCookie;

  if (rawCookie && cookieOwner && cookieOwner !== requestedUser) {
    console.log(
      `[BGGPlayImport] Cookie owner mismatch (cookie owner: "${cookieOwner}", requested: "${username}") - using sanitized cookie without bggusername`
    );
  } else if (requestCookie) {
    console.log(`[BGGPlayImport] Using BGG cookie context for user: "${username}"`);
  }

  if (bggApiToken) {
    console.log("[BGGPlayImport] Using BGG_API_TOKEN for plays requests");
  }

  // Try multiple User-Agent strategies if BGG blocks us
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "BoardGameGeek-API-Client/1.0 (+https://gametaverns.com)",
  ];

  let lastError: Error | null = null;

  for (const userAgent of userAgents) {
    try {
      allPlays.length = 0; // Reset for retry
      page = 1;

      while (true) {
        const url = `https://boardgamegeek.com/xmlapi2/plays?username=${encodeURIComponent(username)}&page=${page}`;
        console.log(`[BGGPlayImport] Fetching page ${page}: ${url} (UA: ${userAgent.slice(0, 30)}...)`);

        const headers: Record<string, string> = {
          "User-Agent": userAgent,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
          "Referer": "https://boardgamegeek.com/",
          "Origin": "https://boardgamegeek.com",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "same-origin",
          "Upgrade-Insecure-Requests": "1",
        };

        if (requestCookie) {
          headers["Cookie"] = requestCookie;
        }

        if (bggApiToken) {
          headers["Authorization"] = `Bearer ${bggApiToken}`;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
          // BGG sometimes returns 202 while preparing a cached response
          if (response.status === 202) {
            console.log("[BGGPlayImport] BGG returned 202, waiting...");
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }

          // 401/403 means BGG is rate-limiting or blocking us
          if (response.status === 401 || response.status === 403 || response.status === 429) {
            const bodySnippet = (await response.text().catch(() => "")).slice(0, 200);
            console.log(`[BGGPlayImport] BGG returned ${response.status}, waiting 5s before retry...`);
            await new Promise((r) => setTimeout(r, 5000));
            throw new Error(`BGG returned ${response.status}: ${bodySnippet || "Rate limited / Access denied"}`);
          }

          const bodySnippet = (await response.text().catch(() => "")).slice(0, 300);
          throw new Error(`BGG API error: ${response.status}${bodySnippet ? ` (${bodySnippet})` : ""}`);
        }

        const xmlText = await response.text();

        // Check for error response
        if (xmlText.includes("<error>")) {
          const errorMatch = xmlText.match(/<message>([^<]+)<\/message>/);
          throw new Error(errorMatch?.[1] || "BGG API error");
        }

        // Check for "Invalid username" which BGG returns as valid XML with total="0"
        if (xmlText.includes('total="0"') && page === 1) {
          console.log(`[BGGPlayImport] BGG returned 0 plays for user ${username}`);
        }

        // Get total plays count
        const totalMatch = xmlText.match(/total="(\d+)"/);
        const total = parseInt(totalMatch?.[1] || "0", 10);

        const plays = parseBGGPlaysXML(xmlText);
        allPlays.push(...plays);

        console.log(
          `[BGGPlayImport] Page ${page}: got ${plays.length} plays, total so far: ${allPlays.length}/${total}`
        );

        if (allPlays.length >= total || plays.length === 0) {
          break;
        }

        page++;
        // Rate limit - be gentle with BGG
        await new Promise((r) => setTimeout(r, 1000));
      }

      // Success! Return the plays
      return allPlays;

    } catch (err) {
      lastError = err as Error;
      console.log(`[BGGPlayImport] User-Agent failed: ${(err as Error).message}, trying next...`);
      // Longer delay between UA retries to let rate limits cool
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  // All User-Agents failed - give a user-friendly message
  throw new Error(
    `BGG is temporarily rate-limiting requests from our server. This usually resolves within a few minutes. Please wait 2-3 minutes and try again. (Technical detail: ${lastError?.message || "unknown error"})`
  );
}

// Export handler
export default async function handler(req: Request): Promise<Response> {
  console.log("[BGGPlayImport] Handler invoked - method:", req.method);
  
  const requestOrigin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(requestOrigin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) {
      console.error("[BGGPlayImport] Auth error:", userError?.message);
      return new Response(JSON.stringify({ success: false, error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse request body
    const body = await req.json().catch(() => null);
    const { bgg_username, library_id, update_existing, source, plays: preParsedsPlays } = body || {};
    const shouldUpdate = update_existing === true;

    // Validate: either bgg_username (BGG fetch) or source=bgstats with plays array
    const isBGStatsImport = source === "bgstats" && Array.isArray(preParsedsPlays);

    if (!isBGStatsImport && (!bgg_username || typeof bgg_username !== "string")) {
      return new Response(JSON.stringify({ success: false, error: "BGG username is required (or provide source='bgstats' with plays array)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!library_id) {
      return new Response(JSON.stringify({ success: false, error: "Library ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user has access to this library (owner or member)
    const { data: library } = await supabaseAdmin
      .from("libraries")
      .select("id, owner_id")
      .eq("id", library_id)
      .single();

    if (!library) {
      return new Response(JSON.stringify({ success: false, error: "Library not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: membership } = await supabaseAdmin
      .from("library_members")
      .select("id")
      .eq("library_id", library_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (library.owner_id !== userId && !membership) {
      return new Response(JSON.stringify({ success: false, error: "You must be a library member to import plays" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine import source for plays
    let bggPlays: BGGPlay[] = [];
    let parsedPlays: Array<{
      game_bgg_id: string | null;
      game_title: string;
      played_at: string;
      duration_minutes: number | null;
      location: string | null;
      notes: string | null;
      source_id: string;
      players: Array<{
        name: string;
        score: number | null;
        is_winner: boolean;
        is_first_play: boolean;
        color: string | null;
        bgg_username?: string | null;
      }>;
    }> = [];

    if (isBGStatsImport) {
      console.log(`[BGGPlayImport] Processing ${preParsedsPlays.length} pre-parsed plays from BGStats`);
      parsedPlays = preParsedsPlays;
    } else {
      console.log(`[BGGPlayImport] Fetching plays for BGG user: ${bgg_username}, update_existing: ${shouldUpdate}`);
      bggPlays = await fetchAllBGGPlays(bgg_username);
      console.log(`[BGGPlayImport] Fetched ${bggPlays.length} plays from BGG`);
      
      if (bggPlays.length > 0 && bggPlays[0].players.length > 0) {
        console.log(`[BGGPlayImport] First play sample - game: ${bggPlays[0].game.name}, players: ${JSON.stringify(bggPlays[0].players.slice(0, 3))}`);
      }
    }

    // Get all games in this library with their BGG IDs
    const { data: libraryGames } = await supabaseAdmin
      .from("games")
      .select("id, title, bgg_id")
      .eq("library_id", library_id);

    const gamesByBggId = new Map<string, { id: string; title: string }>();
    const gamesByTitle = new Map<string, { id: string; title: string }>();
    
    for (const game of libraryGames || []) {
      if (game.bgg_id) {
        gamesByBggId.set(game.bgg_id, { id: game.id, title: game.title });
      }
      gamesByTitle.set(game.title.toLowerCase(), { id: game.id, title: game.title });
    }

    // Get existing sessions with bgg_play_id scoped to THIS library's games to avoid duplicates
    // This allows the same BGG play to be imported into different libraries independently
    const libraryGameIds = (libraryGames || []).map(g => g.id);
    let existingBggPlayIds = new Map<string, string>();
    
    if (libraryGameIds.length > 0) {
      // Batch in chunks to avoid URL length limits
      const chunkSize = 200;
      for (let i = 0; i < libraryGameIds.length; i += chunkSize) {
        const chunk = libraryGameIds.slice(i, i + chunkSize);
        const { data: existingSessions } = await supabaseAdmin
          .from("game_sessions")
          .select("id, bgg_play_id")
          .not("bgg_play_id", "is", null)
          .in("game_id", chunk);
        
        for (const s of existingSessions || []) {
          existingBggPlayIds.set(s.bgg_play_id, s.id);
        }
      }
    }

    const result: ImportResult = {
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      details: {
        importedPlays: [],
        updatedPlays: [],
        skippedDuplicates: [],
        unmatchedGames: [],
        autoCreatedGames: [],
      },
    };

    // Process plays — unified loop for both BGG and BGStats sources
    if (isBGStatsImport) {
      for (const play of parsedPlays) {
        const existingSessionId = existingBggPlayIds.get(play.source_id);
        if (existingSessionId) {
          result.skipped++;
          result.details.skippedDuplicates.push(`${play.game_title} (${play.played_at})`);
          continue;
        }

        let matchedGame = play.game_bgg_id ? gamesByBggId.get(play.game_bgg_id) : undefined;
        if (!matchedGame) matchedGame = gamesByTitle.get(play.game_title.toLowerCase());

        if (!matchedGame && play.game_bgg_id) {
          // Try to auto-create from catalog
          matchedGame = await findOrCreatePlayedOnlyGame(
            supabaseAdmin, library_id, play.game_bgg_id, play.game_title,
            gamesByBggId, gamesByTitle
          ) ?? undefined;
          if (matchedGame) {
            result.details.autoCreatedGames.push(play.game_title);
          }
        }

        if (!matchedGame) {
          result.failed++;
          if (!result.details.unmatchedGames.includes(play.game_title)) {
            result.details.unmatchedGames.push(play.game_title);
          }
          continue;
        }

        try {
          let playedAt = play.played_at;
          if (playedAt && !playedAt.includes("T")) playedAt = playedAt.replace(" ", "T") + "Z";
          if (!playedAt.endsWith("Z") && !playedAt.includes("+")) playedAt += "Z";

          const { data: session, error: sessionError } = await supabaseAdmin
            .from("game_sessions")
            .insert({
              game_id: matchedGame.id,
              played_at: playedAt,
              duration_minutes: play.duration_minutes,
              notes: play.notes,
              location: play.location,
              bgg_play_id: play.source_id,
              import_source: "bgstats",
            })
            .select()
            .single();

          if (sessionError) throw sessionError;

          if (play.players && play.players.length > 0) {
            await supabaseAdmin
              .from("game_session_players")
              .insert(
                play.players.map((p) => ({
                  session_id: session.id,
                  player_name: p.name,
                  score: p.score,
                  is_winner: p.is_winner,
                  is_first_play: p.is_first_play,
                  color: p.color || null,
                }))
              );
          }

          result.imported++;
          result.details.importedPlays.push(`${play.game_title} (${play.played_at})`);
        } catch (err) {
          console.error("[BGGPlayImport] Error importing BGStats play:", err);
          result.failed++;
          result.errors.push(`Failed: ${play.game_title} (${play.played_at}): ${(err as Error).message}`);
        }
      }
    } else {
      for (const play of bggPlays) {
        const existingSessionId = existingBggPlayIds.get(play.id);
        if (existingSessionId) {
          if (shouldUpdate) {
            try {
              let matchedGame = gamesByBggId.get(play.game.objectid);
              if (!matchedGame) matchedGame = gamesByTitle.get(play.game.name.toLowerCase());
              if (!matchedGame) {
                matchedGame = await findOrCreatePlayedOnlyGame(
                  supabaseAdmin, library_id, play.game.objectid, play.game.name,
                  gamesByBggId, gamesByTitle
                ) ?? undefined;
                if (matchedGame) result.details.autoCreatedGames.push(play.game.name);
              }
              if (!matchedGame) {
                result.failed++;
                if (!result.details.unmatchedGames.includes(play.game.name)) result.details.unmatchedGames.push(play.game.name);
                continue;
              }

              await supabaseAdmin.from("game_sessions").update({ duration_minutes: play.length, notes: play.comments, location: play.location }).eq("id", existingSessionId);
              await supabaseAdmin.from("game_session_players").delete().eq("session_id", existingSessionId);

              if (play.players.length > 0) {
                await supabaseAdmin.from("game_session_players").insert(
                  play.players.map((p) => ({ session_id: existingSessionId, player_name: p.name, score: p.score ? parseInt(p.score, 10) : null, is_winner: p.win, is_first_play: p.new, color: p.color || null }))
                );
              }

              result.updated++;
              result.details.updatedPlays.push(`${play.game.name} (${play.date})`);
            } catch (err) {
              result.failed++;
              result.errors.push(`Failed to update ${play.game.name} (${play.date}): ${(err as Error).message}`);
            }
          } else {
            result.skipped++;
            result.details.skippedDuplicates.push(`${play.game.name} (${play.date})`);
          }
          continue;
        }

        let matchedGame = gamesByBggId.get(play.game.objectid);
        if (!matchedGame) matchedGame = gamesByTitle.get(play.game.name.toLowerCase());

        if (!matchedGame) {
          // Try to auto-create from catalog
          matchedGame = await findOrCreatePlayedOnlyGame(
            supabaseAdmin, library_id, play.game.objectid, play.game.name,
            gamesByBggId, gamesByTitle
          ) ?? undefined;
          if (matchedGame) {
            result.details.autoCreatedGames.push(play.game.name);
          }
        }

        if (!matchedGame) {
          result.failed++;
          if (!result.details.unmatchedGames.includes(play.game.name)) result.details.unmatchedGames.push(play.game.name);
          continue;
        }

        try {
          const { data: session, error: sessionError } = await supabaseAdmin
            .from("game_sessions")
            .insert({ game_id: matchedGame.id, played_at: `${play.date}T12:00:00Z`, duration_minutes: play.length, notes: play.comments, location: play.location, bgg_play_id: play.id, import_source: "bgg" })
            .select().single();

          if (sessionError) throw sessionError;

          if (play.players.length > 0) {
            await supabaseAdmin.from("game_session_players").insert(
              play.players.map((p) => ({ session_id: session.id, player_name: p.name, score: p.score ? parseInt(p.score, 10) : null, is_winner: p.win, is_first_play: p.new, color: p.color || null }))
            );
          }

          result.imported++;
          result.details.importedPlays.push(`${play.game.name} (${play.date})`);

          for (let i = 1; i < play.quantity; i++) {
            const { data: extraSession, error: extraError } = await supabaseAdmin
              .from("game_sessions")
              .insert({ game_id: matchedGame.id, played_at: `${play.date}T12:00:00Z`, duration_minutes: play.length, notes: play.comments ? `${play.comments} (play ${i + 1}/${play.quantity})` : `Play ${i + 1}/${play.quantity}`, location: play.location, bgg_play_id: `${play.id}_${i + 1}`, import_source: "bgg" })
              .select().single();

            if (!extraError && extraSession && play.players.length > 0) {
              await supabaseAdmin.from("game_session_players").insert(
                play.players.map((p) => ({ session_id: extraSession.id, player_name: p.name, score: p.score ? parseInt(p.score, 10) : null, is_winner: p.win, is_first_play: false, color: p.color || null }))
              );
            }
            if (!extraError) result.imported++;
          }
        } catch (err) {
          result.failed++;
          result.errors.push(`Failed to import ${play.game.name} (${play.date}): ${(err as Error).message}`);
        }
      }
    }

    console.log(`[BGGPlayImport] Import complete: ${result.imported} imported, ${result.skipped} skipped, ${result.failed} failed`);

    return new Response(JSON.stringify({
      success: true,
      ...result,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[BGGPlayImport] Error:", error);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message || "Import failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// For Lovable Cloud deployment
if (import.meta.main) {
  Deno.serve(handler);
}
