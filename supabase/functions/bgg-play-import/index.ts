import { createClient } from "npm:@supabase/supabase-js@2";

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
  };
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
      
      // Extract name - try multiple patterns since BGG can format differently
      const nameMatch = playerAttrs.match(/name="([^"]*)"/);
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

  // Optional: allow self-hosted operators to provide a BGG cookie if BGG blocks server-to-server traffic.
  // Example value: "bggusername=...; SessionID=..." (whatever your browser sends to boardgamegeek.com)
  const bggCookie = Deno.env.get("BGG_SESSION_COOKIE") || Deno.env.get("BGG_COOKIE") || "";

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
          // BGG can block “server-y” traffic; these headers mimic a real browser request more closely.
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

        if (bggCookie) {
          headers["Cookie"] = bggCookie;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
          // BGG sometimes returns 202 while preparing a cached response
          if (response.status === 202) {
            console.log("[BGGPlayImport] BGG returned 202, waiting...");
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }

          // 401/403 means BGG is blocking us - try next User-Agent
          if (response.status === 401 || response.status === 403) {
            const bodySnippet = (await response.text().catch(() => "")).slice(0, 200);
            throw new Error(`BGG returned ${response.status}: ${bodySnippet || "Access denied"}`);
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
          // Could be valid (user has no plays) or invalid username
          // We'll proceed - empty result is fine
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
      // Small delay before retry with different UA
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // All User-Agents failed
  const hasCookie = !!bggCookie;
  const errorMsg = hasCookie
    ? `BGG is blocking server requests. Your BGG_SESSION_COOKIE may be expired/invalid (BGG returned: ${lastError?.message || "unknown error"}). Re-login to BGG in a browser and update the cookie value.`
    : `BGG is blocking server requests (${lastError?.message || "unknown error"}). To fix this, set BGG_SESSION_COOKIE (from your browser) in your server environment and restart the functions service.`;
  
  throw new Error(errorMsg);
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
    const { bgg_username, library_id, update_existing } = body || {};
    const shouldUpdate = update_existing === true;

    if (!bgg_username || typeof bgg_username !== "string") {
      return new Response(JSON.stringify({ success: false, error: "BGG username is required" }), {
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

    console.log(`[BGGPlayImport] Fetching plays for BGG user: ${bgg_username}, update_existing: ${shouldUpdate}`);

    // Fetch plays from BGG
    const bggPlays = await fetchAllBGGPlays(bgg_username);
    console.log(`[BGGPlayImport] Fetched ${bggPlays.length} plays from BGG`);
    
    // Log first play's player data for debugging
    if (bggPlays.length > 0 && bggPlays[0].players.length > 0) {
      console.log(`[BGGPlayImport] First play sample - game: ${bggPlays[0].game.name}, players: ${JSON.stringify(bggPlays[0].players.slice(0, 3))}`);
    } else if (bggPlays.length > 0) {
      console.log(`[BGGPlayImport] First play has no players - game: ${bggPlays[0].game.name}`);
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

    // Get existing sessions with bgg_play_id to avoid duplicates (or update them)
    const { data: existingSessions } = await supabaseAdmin
      .from("game_sessions")
      .select("id, bgg_play_id")
      .not("bgg_play_id", "is", null);

    const existingBggPlayIds = new Map<string, string>(
      (existingSessions || []).map(s => [s.bgg_play_id, s.id])
    );

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
      },
    };

    // Process each play
    for (const play of bggPlays) {
      // Check if already imported (by bgg_play_id)
      const existingSessionId = existingBggPlayIds.get(play.id);
      if (existingSessionId) {
        if (shouldUpdate) {
          // Update existing session and its players
          try {
            // Find matching game in library
            let matchedGame = gamesByBggId.get(play.game.objectid);
            if (!matchedGame) {
              matchedGame = gamesByTitle.get(play.game.name.toLowerCase());
            }
            
            if (!matchedGame) {
              result.failed++;
              if (!result.details.unmatchedGames.includes(play.game.name)) {
                result.details.unmatchedGames.push(play.game.name);
              }
              continue;
            }

            // Update the session
            await supabaseAdmin
              .from("game_sessions")
              .update({
                duration_minutes: play.length,
                notes: play.comments,
                location: play.location,
              })
              .eq("id", existingSessionId);

            // Delete old players and re-insert with fresh data
            await supabaseAdmin
              .from("game_session_players")
              .delete()
              .eq("session_id", existingSessionId);

            if (play.players.length > 0) {
              await supabaseAdmin
                .from("game_session_players")
                .insert(
                  play.players.map((p) => ({
                    session_id: existingSessionId,
                    player_name: p.name, // Already resolved in parser
                    score: p.score ? parseInt(p.score, 10) : null,
                    is_winner: p.win,
                    is_first_play: p.new,
                    color: p.color || null,
                  }))
                );
            }

            result.updated++;
            result.details.updatedPlays.push(`${play.game.name} (${play.date})`);
          } catch (err) {
            console.error("[BGGPlayImport] Error updating play:", err);
            result.failed++;
            result.errors.push(`Failed to update ${play.game.name} (${play.date}): ${(err as Error).message}`);
          }
        } else {
          result.skipped++;
          result.details.skippedDuplicates.push(`${play.game.name} (${play.date})`);
        }
        continue;
      }

      // Find matching game in library
      let matchedGame = gamesByBggId.get(play.game.objectid);
      if (!matchedGame) {
        // Try matching by title (case-insensitive)
        matchedGame = gamesByTitle.get(play.game.name.toLowerCase());
      }

      if (!matchedGame) {
        result.failed++;
        if (!result.details.unmatchedGames.includes(play.game.name)) {
          result.details.unmatchedGames.push(play.game.name);
        }
        continue;
      }

      try {
        // Create session
        const { data: session, error: sessionError } = await supabaseAdmin
          .from("game_sessions")
          .insert({
            game_id: matchedGame.id,
            played_at: `${play.date}T12:00:00Z`, // Default to noon if no time
            duration_minutes: play.length,
            notes: play.comments,
            location: play.location,
            bgg_play_id: play.id,
            import_source: "bgg",
          })
          .select()
          .single();

        if (sessionError) throw sessionError;

        // Create players if any
        if (play.players.length > 0) {
          const { error: playersError } = await supabaseAdmin
            .from("game_session_players")
            .insert(
              play.players.map((p) => ({
                session_id: session.id,
                player_name: p.name, // Already resolved in parser
                score: p.score ? parseInt(p.score, 10) : null,
                is_winner: p.win,
                is_first_play: p.new,
                color: p.color || null,
              }))
            );

          if (playersError) {
            console.error("[BGGPlayImport] Player insert error:", playersError);
          }
        }

        result.imported++;
        result.details.importedPlays.push(`${play.game.name} (${play.date})`);

        // Handle quantity > 1 (multiple plays on same day)
        for (let i = 1; i < play.quantity; i++) {
          const { data: extraSession, error: extraError } = await supabaseAdmin
            .from("game_sessions")
            .insert({
              game_id: matchedGame.id,
              played_at: `${play.date}T12:00:00Z`,
              duration_minutes: play.length,
              notes: play.comments ? `${play.comments} (play ${i + 1}/${play.quantity})` : `Play ${i + 1}/${play.quantity}`,
              location: play.location,
              bgg_play_id: `${play.id}_${i + 1}`, // Unique ID for each extra play
              import_source: "bgg",
            })
            .select()
            .single();

          if (!extraError && extraSession && play.players.length > 0) {
            await supabaseAdmin
              .from("game_session_players")
              .insert(
                play.players.map((p) => ({
                  session_id: extraSession.id,
                  player_name: p.name, // Already resolved in parser
                  score: p.score ? parseInt(p.score, 10) : null,
                  is_winner: p.win,
                  is_first_play: false, // Only first play counts as "new"
                  color: p.color || null,
                }))
              );
          }

          if (!extraError) {
            result.imported++;
          }
        }
      } catch (err) {
        console.error("[BGGPlayImport] Error importing play:", err);
        result.failed++;
        result.errors.push(`Failed to import ${play.game.name} (${play.date}): ${(err as Error).message}`);
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
