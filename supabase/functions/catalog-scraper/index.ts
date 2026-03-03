import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const decodeHtmlEntities = (input: string) =>
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

/** Parse a multi-item BGG XML response into individual game records */
function parseBggItems(xml: string) {
  const items: ParsedGame[] = [];
  // Match each <item> block
  const itemRegex = /<item\s+type="([^"]*)"[^>]*id="(\d+)"[^>]*>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemType = match[1];
    const bggId = match[2];
    const block = match[3];

    const getValue = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*value="([^"]*)"`, "i"));
      return m ? decodeHtmlEntities(m[1]) : null;
    };

    const nameMatch = block.match(/<name\s+type="primary"[^>]*value="([^"]+)"/);
    const title = nameMatch ? decodeHtmlEntities(nameMatch[1]) : getValue("name") || "Unknown";

    const imageMatch = block.match(/<image>([^<]+)<\/image>/);
    const descMatch = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
    const ratingMatch = block.match(/<average\s+value="([^"]+)"/);
    const weightMatch = block.match(/<averageweight\s+value="([^"]+)"/);
    const yearMatch = block.match(/<yearpublished[^>]*value="([^"]+)"/);

    const bggRating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
    const weight = weightMatch ? parseFloat(weightMatch[1]) : null;

    // Extract metadata links
    const mechanicsMatches = block.matchAll(/<link[^>]*type="boardgamemechanic"[^>]*value="([^"]+)"/g);
    const mechanics = [...mechanicsMatches].map((m) => decodeHtmlEntities(m[1]));
    const publisherMatch = block.match(/<link[^>]*type="boardgamepublisher"[^>]*value="([^"]+)"/);
    const designerMatches = block.matchAll(/<link[^>]*type="boardgamedesigner"[^>]*value="([^"]+)"/g);
    const designers = [...designerMatches].map((m) => decodeHtmlEntities(m[1]));
    const artistMatches = block.matchAll(/<link[^>]*type="boardgameartist"[^>]*value="([^"]+)"/g);
    const artists = [...artistMatches].map((m) => decodeHtmlEntities(m[1]));

    // Extract BGG categories for secondary filtering
    const categoryMatches = block.matchAll(/<link[^>]*type="boardgamecategory"[^>]*value="([^"]+)"/g);
    const categories = [...categoryMatches].map((m) => decodeHtmlEntities(m[1]));

    // Only process actual board games and expansions — skip video games, RPGs, accessories, etc.
    const ALLOWED_TYPES = ["boardgame", "boardgameexpansion"];
    if (!ALLOWED_TYPES.includes(itemType)) {
      console.log(`[catalog-scraper] Skipping BGG ID ${bggId} (type="${itemType}", title="${title}")`);
      continue;
    }

    // Secondary filter: skip entries with non-board-game categories
    const EXCLUDED_CATEGORIES = [
      "Electronic", "Video Game",
      "Book",  // RPG sourcebooks, supplements
    ];
    const hasExcludedCategory = categories.some(c => EXCLUDED_CATEGORIES.includes(c));
    
    // Also check for RPG-only items: type "boardgame" on BGG but actually RPG supplements
    const RPG_ONLY_CATEGORIES = ["Role Playing"];
    const isRpgOnly = categories.length > 0 && 
      categories.every(c => RPG_ONLY_CATEGORIES.includes(c) || c === "Expansion for Base-game");

    // Board game indicators that override exclusion
    const BOARD_GAME_INDICATORS = [
      "Card Game", "Dice", "Board Game", "Miniatures", "Party Game", 
      "Wargame", "Abstract Strategy", "Collectible Components", "Trivia",
      "Children's Game", "Puzzle", "Deduction", "Word Game",
    ];
    const hasBoardGameIndicator = categories.some(c => BOARD_GAME_INDICATORS.includes(c));
    
    // Skip if: has excluded category without board game indicators, OR is RPG-only with no mechanics
    if ((hasExcludedCategory && !hasBoardGameIndicator && mechanics.length === 0) ||
        (isRpgOnly && !hasBoardGameIndicator && mechanics.length === 0 && designers.length === 0)) {
      console.log(`[catalog-scraper] Skipping BGG ID ${bggId} — non-board-game: "${title}" (categories: ${categories.join(", ")})`);
      continue;
    }

    // Quality gate: skip ghost entries with no image, no description, and no ratings
    const usersRatedMatch = block.match(/<usersrated\s+value="([^"]+)"/);
    const usersRated = usersRatedMatch ? parseInt(usersRatedMatch[1]) || 0 : 0;
    const hasImage = !!imageMatch;
    const hasDescription = !!descMatch && descMatch[1].trim().length > 20;

    // Skip entries that are essentially empty placeholders on BGG
    if (!hasImage && !hasDescription && usersRated === 0) {
      console.log(`[catalog-scraper] Skipping BGG ID ${bggId} — ghost entry: "${title}" (no image, no desc, 0 ratings)`);
      continue;
    }

    // Skip obscure fan-made items with <3 ratings and no mechanics (likely spam/placeholders)
    if (usersRated < 3 && mechanics.length === 0 && !hasDescription) {
      console.log(`[catalog-scraper] Skipping BGG ID ${bggId} — low-quality: "${title}" (${usersRated} ratings, no mechanics)`);
      continue;
    }

    // Detect expansion
    const isExpansion = itemType === "boardgameexpansion";

    items.push({
      bggId,
      title,
      description: descMatch ? decodeHtmlEntities(descMatch[1]).trim().slice(0, 5000) : null,
      imageUrl: imageMatch ? imageMatch[1].trim() : null,
      minPlayers: parseInt(getValue("minplayers") || "0") || null,
      maxPlayers: parseInt(getValue("maxplayers") || "0") || null,
      playTimeMinutes: parseInt(getValue("playingtime") || "0") || null,
      suggestedAge: getValue("minage") ? `${getValue("minage")}+` : null,
      yearPublished: yearMatch ? parseInt(yearMatch[1]) || null : null,
      bggCommunityRating: bggRating && !isNaN(bggRating) && bggRating > 0
        ? Math.round(bggRating * 10) / 10 : null,
      weight: weight && !isNaN(weight) && weight > 0
        ? Math.round(weight * 100) / 100 : null,
      isExpansion,
      bggVerifiedType: itemType,
      bggUrl: `https://boardgamegeek.com/boardgame/${bggId}`,
      mechanics,
      publisher: publisherMatch?.[1] ? decodeHtmlEntities(publisherMatch[1]) : null,
      designers,
      artists,
    });
  }
  return items;
}

/** Check if a description has already been AI-formatted (contains the format marker) */
function isDescriptionFormatted(desc: string | null | undefined): boolean {
  return !!desc && desc.includes("Quick Gameplay Overview");
}

interface ParsedGame {
  bggId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playTimeMinutes: number | null;
  suggestedAge: string | null;
  bggVerifiedType: string;
  yearPublished: number | null;
  bggCommunityRating: number | null;
  weight: number | null;
  isExpansion: boolean;
  bggUrl: string;
  mechanics: string[];
  publisher: string | null;
  designers: string[];
  artists: string[];
}

/**
 * Catalog Scraper — Automated BGG game discovery
 *
 * Iterates through BGG IDs in batches of 20 (using multi-ID thing API),
 * creating catalog entries for games not yet in the database.
 *
 * Designed to be called by pg_cron every 5 minutes.
 *
 * Actions:
 * - GET or POST with no body: run a scrape batch
 * - POST { action: "status" }: return current scraper state
 * - POST { action: "enable" }: enable the scraper
 * - POST { action: "disable" }: disable the scraper
 * - POST { action: "reset", next_bgg_id: N }: reset position
 *
 * Requires service_role authorization.
 */
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("API_EXTERNAL_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Missing env config" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth: accept service_role key OR admin user JWT
  const authHeader = req.headers.get("Authorization") || "";
  let isAuthorized = authHeader.includes(serviceKey);

  if (!isAuthorized) {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    if (anonKey && authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const admin = createClient(supabaseUrl, serviceKey);
        const { data: roleData } = await admin
          .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
        if (roleData) isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const body = await req.json().catch(() => ({}));
  const action = body.action || "scrape";

  // =========================================================================
  // STATUS
  // =========================================================================
  if (action === "status") {
    const { data: state } = await admin.from("catalog_scraper_state").select("*").eq("id", "default").single();
    const { count: catalogCount } = await admin.from("game_catalog").select("id", { count: "exact", head: true });
    return new Response(JSON.stringify({ ...state, catalog_count: catalogCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // =========================================================================
  // ENABLE / DISABLE / RESET
  // =========================================================================
  if (action === "enable" || action === "disable") {
    await admin.from("catalog_scraper_state").update({
      is_enabled: action === "enable",
      updated_at: new Date().toISOString(),
    }).eq("id", "default");
    return new Response(JSON.stringify({ success: true, is_enabled: action === "enable" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "reset") {
    const nextId = body.next_bgg_id || 1;
    await admin.from("catalog_scraper_state").update({
      next_bgg_id: nextId,
      updated_at: new Date().toISOString(),
    }).eq("id", "default");
    return new Response(JSON.stringify({ success: true, next_bgg_id: nextId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // =========================================================================
  // FETCH_IDS — Scrape specific BGG IDs (for backfilling missed games)
  // =========================================================================
  if (action === "fetch_ids") {
    const specificIds: number[] = (body.bgg_ids || []).map(Number).filter((n: number) => n > 0);
    if (specificIds.length === 0) {
      return new Response(JSON.stringify({ error: "No valid bgg_ids provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (specificIds.length > 100) {
      return new Response(JSON.stringify({ error: "Max 100 IDs per request" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bggApiToken = Deno.env.get("BGG_API_TOKEN") || "";
    const bggCookie = Deno.env.get("BGG_SESSION_COOKIE") || Deno.env.get("BGG_COOKIE") || "";
    const bggHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/xml",
      Referer: "https://boardgamegeek.com/",
      Origin: "https://boardgamegeek.com",
    };
    if (bggApiToken) bggHeaders["Authorization"] = `Bearer ${bggApiToken}`;
    if (bggCookie) bggHeaders["Cookie"] = bggCookie;

    let totalAdded = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const results: { bgg_id: number; title?: string; status: string; error?: string }[] = [];

    // Process in chunks of 20 (BGG API limit)
    const CHUNK = 20;
    for (let i = 0; i < specificIds.length; i += CHUNK) {
      const chunk = specificIds.slice(i, i + CHUNK);
      const idStr = chunk.join(",");
      const url = `https://boardgamegeek.com/xmlapi2/thing?id=${idStr}&type=boardgame,boardgameexpansion&stats=1`;

      let xml: string | null = null;
      let attempts = 0;
      while (attempts < 3 && !xml) {
        attempts++;
        try {
          const res = await fetch(url, { headers: bggHeaders });
          if (res.status === 202) { await sleep(5000); continue; }
          if (res.status === 429) { await sleep(attempts * 3000); continue; }
          if (res.ok) xml = await res.text();
          else break;
        } catch { if (attempts < 3) await sleep(2000); }
      }

      if (!xml) {
        for (const id of chunk) results.push({ bgg_id: id, status: "error", error: "BGG fetch failed" });
        totalErrors += chunk.length;
        continue;
      }

      const games = parseBggItems(xml);

      for (const game of games) {
        try {
          // Check if already exists by bgg_id
          const { data: existing } = await admin
            .from("game_catalog").select("id, description").eq("bgg_id", game.bggId).maybeSingle();

          if (existing) {
            // Update with fresh BGG data, but preserve AI-formatted descriptions
            const updateData: Record<string, any> = {
              image_url: game.imageUrl,
              min_players: game.minPlayers,
              max_players: game.maxPlayers,
              play_time_minutes: game.playTimeMinutes,
              suggested_age: game.suggestedAge,
              year_published: game.yearPublished,
              bgg_community_rating: game.bggCommunityRating,
              weight: game.weight,
              is_expansion: game.isExpansion,
              bgg_url: game.bggUrl,
            };
            // Only overwrite description if not already AI-formatted
            if (!isDescriptionFormatted(existing.description)) {
              updateData.description = game.description;
            }
            await admin.from("game_catalog").update(updateData).eq("id", existing.id);
            results.push({ bgg_id: Number(game.bggId), title: game.title, status: "updated" });
            totalSkipped++;
            continue;
          }

          // Check for NULL-bgg_id title match
          const { data: titleMatch } = await admin
            .from("game_catalog").select("id, description").eq("title", game.title).is("bgg_id", null).limit(1).maybeSingle();

          let entryId: string | null = null;
          if (titleMatch) {
            const titleUpdateData: Record<string, any> = {
              bgg_id: game.bggId, image_url: game.imageUrl,
              min_players: game.minPlayers, max_players: game.maxPlayers, play_time_minutes: game.playTimeMinutes,
              suggested_age: game.suggestedAge, year_published: game.yearPublished,
              bgg_community_rating: game.bggCommunityRating, weight: game.weight,
              is_expansion: game.isExpansion, bgg_url: game.bggUrl,
            };
            if (!isDescriptionFormatted(titleMatch.description)) {
              titleUpdateData.description = game.description;
            }
            const { data } = await admin.from("game_catalog").update(titleUpdateData).eq("id", titleMatch.id).select("id").single();
            entryId = data?.id || null;
          } else {
            const { data } = await admin.from("game_catalog").upsert({
              bgg_id: game.bggId, title: game.title, description: game.description, image_url: game.imageUrl,
              min_players: game.minPlayers, max_players: game.maxPlayers, play_time_minutes: game.playTimeMinutes,
              suggested_age: game.suggestedAge, year_published: game.yearPublished,
              bgg_community_rating: game.bggCommunityRating, weight: game.weight,
              is_expansion: game.isExpansion, bgg_url: game.bggUrl,
            }, { onConflict: "bgg_id" }).select("id").single();
            entryId = data?.id || null;
          }

          if (entryId) {
            // Upsert mechanics, publishers, designers, artists
            for (const mechName of game.mechanics) {
              const { data: mech } = await admin.from("mechanics").upsert({ name: mechName }, { onConflict: "name" }).select("id").single();
              if (mech?.id) await admin.from("catalog_mechanics").upsert({ catalog_id: entryId, mechanic_id: mech.id }, { onConflict: "catalog_id,mechanic_id" });
            }
            if (game.publisher) {
              const { data: pub } = await admin.from("publishers").upsert({ name: game.publisher }, { onConflict: "name" }).select("id").single();
              if (pub?.id) await admin.from("catalog_publishers").upsert({ catalog_id: entryId, publisher_id: pub.id }, { onConflict: "catalog_id,publisher_id" });
            }
            for (const name of game.designers) {
              const { data: d } = await admin.from("designers").upsert({ name }, { onConflict: "name" }).select("id").single();
              if (d?.id) await admin.from("catalog_designers").upsert({ catalog_id: entryId, designer_id: d.id }, { onConflict: "catalog_id,designer_id" });
            }
            for (const name of game.artists) {
              const { data: a } = await admin.from("artists").upsert({ name }, { onConflict: "name" }).select("id").single();
              if (a?.id) await admin.from("catalog_artists").upsert({ catalog_id: entryId, artist_id: a.id }, { onConflict: "catalog_id,artist_id" });
            }
            results.push({ bgg_id: Number(game.bggId), title: game.title, status: "added" });
            totalAdded++;
          }
        } catch (e) {
          results.push({ bgg_id: Number(game.bggId), status: "error", error: e instanceof Error ? e.message : String(e) });
          totalErrors++;
        }
      }

      // IDs not found in BGG response
      const foundIds = new Set(games.map(g => Number(g.bggId)));
      for (const id of chunk) {
        if (!foundIds.has(id)) results.push({ bgg_id: id, status: "not_found" });
      }

      if (i + CHUNK < specificIds.length) await sleep(1500);
    }

    return new Response(JSON.stringify({ success: true, added: totalAdded, updated: totalSkipped, errors: totalErrors, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // =========================================================================
  // SWEEP — Weekly smart scan for newly added BGG games
  // Instead of grinding through millions of IDs, this:
  // 1. Finds the max BGG ID currently in our catalog
  // 2. Scans forward from there to catch brand new entries
  // 3. Also does a quick pass through "recent hotspot" range (recent BGG IDs)
  // =========================================================================
  if (action === "sweep") {
    const bggApiToken = Deno.env.get("BGG_API_TOKEN") || "";
    const bggCookie = Deno.env.get("BGG_SESSION_COOKIE") || Deno.env.get("BGG_COOKIE") || "";
    const bggHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/xml",
      Referer: "https://boardgamegeek.com/",
      Origin: "https://boardgamegeek.com",
    };
    if (bggApiToken) bggHeaders["Authorization"] = `Bearer ${bggApiToken}`;
    if (bggCookie) bggHeaders["Cookie"] = bggCookie;

    // Find the current max BGG ID in our catalog
    const { data: maxRow } = await admin
      .from("game_catalog")
      .select("bgg_id")
      .not("bgg_id", "is", null)
      .order("bgg_id", { ascending: false })
      .limit(1)
      .single();

    const maxCatalogBggId = maxRow?.bgg_id ? parseInt(maxRow.bgg_id) : 400000;
    
    // Sweep range: scan from max known ID forward by a buffer (catch new releases)
    const FORWARD_BUFFER = body.forward_buffer || 5000;
    const BATCH_SIZE = 20;
    const BATCHES_PER_RUN = body.batches || 15; // 15 batches × 20 = 300 IDs per sweep
    
    const sweepStart = maxCatalogBggId + 1;
    const sweepEnd = sweepStart + (BATCHES_PER_RUN * BATCH_SIZE) + FORWARD_BUFFER;
    
    console.log(`[catalog-scraper] SWEEP: max catalog BGG ID = ${maxCatalogBggId}, scanning ${sweepStart}–${sweepEnd}`);

    let currentId = sweepStart;
    let totalAdded = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let lastError: string | null = null;
    let consecutiveEmpty = 0;
    const MAX_CONSECUTIVE_EMPTY = 10; // Stop if 10 consecutive batches yield nothing

    for (let batch = 0; batch < BATCHES_PER_RUN; batch++) {
      if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) {
        console.log(`[catalog-scraper] SWEEP: ${MAX_CONSECUTIVE_EMPTY} consecutive empty batches, stopping early`);
        break;
      }

      const ids = Array.from({ length: BATCH_SIZE }, (_, i) => currentId + i);
      const idStr = ids.join(",");

      // Check which IDs already exist
      const { data: existing } = await admin
        .from("game_catalog")
        .select("bgg_id")
        .in("bgg_id", ids.map(String));
      const existingIds = new Set((existing || []).map(e => e.bgg_id));

      const newIds = ids.filter(id => !existingIds.has(String(id)));
      if (newIds.length === 0) {
        totalSkipped += BATCH_SIZE;
        currentId += BATCH_SIZE;
        consecutiveEmpty++;
        continue;
      }

      const url = `https://boardgamegeek.com/xmlapi2/thing?id=${idStr}&type=boardgame,boardgameexpansion&stats=1`;
      let xml: string | null = null;
      let fetchAttempts = 0;

      while (fetchAttempts < 3) {
        fetchAttempts++;
        try {
          const res = await fetch(url, { headers: bggHeaders });
          if (res.status === 429) { await sleep(fetchAttempts * 3000); continue; }
          if (res.status === 202) { await sleep(5000); continue; }
          if (!res.ok) { lastError = `HTTP ${res.status}`; totalErrors++; break; }
          xml = await res.text();
          break;
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
          if (fetchAttempts < 3) await sleep(2000);
        }
      }

      if (!xml) { totalErrors++; currentId += BATCH_SIZE; consecutiveEmpty++; continue; }

      const games = parseBggItems(xml);

      if (games.length === 0) {
        consecutiveEmpty++;
        currentId += BATCH_SIZE;
        totalSkipped += BATCH_SIZE;
        continue;
      }

      consecutiveEmpty = 0; // Reset on finding games

      for (const game of games) {
        if (existingIds.has(game.bggId)) { totalSkipped++; continue; }
        try {
          const { data: titleMatch } = await admin
            .from("game_catalog").select("id, description").eq("title", game.title).is("bgg_id", null).limit(1).maybeSingle();

          let entry: { id: string } | null = null;
          if (titleMatch) {
            const sweepUpdateData: Record<string, any> = {
              bgg_id: game.bggId, bgg_verified_type: game.bggVerifiedType,
              image_url: game.imageUrl,
              min_players: game.minPlayers, max_players: game.maxPlayers,
              play_time_minutes: game.playTimeMinutes, suggested_age: game.suggestedAge,
              year_published: game.yearPublished, bgg_community_rating: game.bggCommunityRating,
              weight: game.weight, is_expansion: game.isExpansion, bgg_url: game.bggUrl,
            };
            if (!isDescriptionFormatted(titleMatch.description)) {
              sweepUpdateData.description = game.description;
            }
            const { data } = await admin.from("game_catalog").update(sweepUpdateData).eq("id", titleMatch.id).select("id").single();
            entry = data;
          } else {
            const { data } = await admin.from("game_catalog").upsert({
              bgg_id: game.bggId, bgg_verified_type: game.bggVerifiedType,
              title: game.title, description: game.description, image_url: game.imageUrl,
              min_players: game.minPlayers, max_players: game.maxPlayers,
              play_time_minutes: game.playTimeMinutes, suggested_age: game.suggestedAge,
              year_published: game.yearPublished, bgg_community_rating: game.bggCommunityRating,
              weight: game.weight, is_expansion: game.isExpansion, bgg_url: game.bggUrl,
            }, { onConflict: "bgg_id" }).select("id").single();
            entry = data;
          }

          if (entry?.id) {
            // Upsert metadata
            for (const mechName of game.mechanics) {
              const { data: mech } = await admin.from("mechanics").upsert({ name: mechName }, { onConflict: "name" }).select("id").single();
              if (mech?.id) await admin.from("catalog_mechanics").upsert({ catalog_id: entry.id, mechanic_id: mech.id }, { onConflict: "catalog_id,mechanic_id" });
            }
            if (game.publisher) {
              const { data: pub } = await admin.from("publishers").upsert({ name: game.publisher }, { onConflict: "name" }).select("id").single();
              if (pub?.id) await admin.from("catalog_publishers").upsert({ catalog_id: entry.id, publisher_id: pub.id }, { onConflict: "catalog_id,publisher_id" });
            }
            for (const name of game.designers) {
              const { data: d } = await admin.from("designers").upsert({ name }, { onConflict: "name" }).select("id").single();
              if (d?.id) await admin.from("catalog_designers").upsert({ catalog_id: entry.id, designer_id: d.id }, { onConflict: "catalog_id,designer_id" });
            }
            for (const name of game.artists) {
              const { data: a } = await admin.from("artists").upsert({ name }, { onConflict: "name" }).select("id").single();
              if (a?.id) await admin.from("catalog_artists").upsert({ catalog_id: entry.id, artist_id: a.id }, { onConflict: "catalog_id,artist_id" });
            }
            totalAdded++;
          }
        } catch (e) {
          totalErrors++;
          lastError = `${game.bggId}: ${e instanceof Error ? e.message : String(e)}`;
        }
      }

      currentId += BATCH_SIZE;
      if (batch < BATCHES_PER_RUN - 1) await sleep(1500);
    }

    // Update scraper state
    const { data: currentState } = await admin
      .from("catalog_scraper_state").select("*").eq("id", "default").single();

    if (currentState) {
      await admin.from("catalog_scraper_state").upsert({
        id: "default",
        next_bgg_id: currentId,
        total_processed: (currentState.total_processed || 0) + (currentId - sweepStart),
        total_added: (currentState.total_added || 0) + totalAdded,
        total_skipped: (currentState.total_skipped || 0) + totalSkipped,
        total_errors: (currentState.total_errors || 0) + totalErrors,
        last_run_at: new Date().toISOString(),
        last_error: lastError,
        updated_at: new Date().toISOString(),
        is_enabled: currentState.is_enabled,
      }, { onConflict: "id" });
    }

    const result = {
      success: true,
      mode: "sweep",
      sweep_range: `${sweepStart}–${currentId - 1}`,
      max_catalog_bgg_id: maxCatalogBggId,
      added: totalAdded,
      skipped: totalSkipped,
      errors: totalErrors,
      stopped_early: consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY,
    };
    console.log(`[catalog-scraper] SWEEP complete:`, JSON.stringify(result));
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // =========================================================================
  // SCRAPE — Main batch processing (legacy sequential scan)
  // =========================================================================
  const { data: state, error: stateErr } = await admin
    .from("catalog_scraper_state").select("*").eq("id", "default").single();

  if (stateErr || !state) {
    return new Response(JSON.stringify({ error: "No scraper state found" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!state.is_enabled) {
    return new Response(JSON.stringify({ skipped: true, reason: "Scraper is disabled" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const BATCH_SIZE = 20;
  const BATCHES_PER_RUN = body.batches || 10;
  const startBggId = state.next_bgg_id;
  let currentId = startBggId;
  let totalAdded = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let lastError: string | null = null;

  console.log(`[catalog-scraper] Starting from BGG ID ${startBggId}, ${BATCHES_PER_RUN} batches of ${BATCH_SIZE}`);

  const bggApiToken = Deno.env.get("BGG_API_TOKEN") || "";
  const bggCookie = Deno.env.get("BGG_SESSION_COOKIE") || Deno.env.get("BGG_COOKIE") || "";
  const bggHeaders: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Accept: "application/xml",
    Referer: "https://boardgamegeek.com/",
    Origin: "https://boardgamegeek.com",
  };
  if (bggApiToken) bggHeaders["Authorization"] = `Bearer ${bggApiToken}`;
  if (bggCookie) bggHeaders["Cookie"] = bggCookie;

  for (let batch = 0; batch < BATCHES_PER_RUN; batch++) {
    const ids = Array.from({ length: BATCH_SIZE }, (_, i) => currentId + i);
    const idStr = ids.join(",");

    const { data: existing } = await admin
      .from("game_catalog").select("bgg_id").in("bgg_id", ids.map(String));
    const existingIds = new Set((existing || []).map(e => e.bgg_id));

    const newIds = ids.filter(id => !existingIds.has(String(id)));
    if (newIds.length === 0) {
      totalSkipped += BATCH_SIZE;
      currentId += BATCH_SIZE;
      continue;
    }

    const url = `https://boardgamegeek.com/xmlapi2/thing?id=${idStr}&type=boardgame,boardgameexpansion&stats=1`;
    let xml: string | null = null;
    let fetchAttempts = 0;

    while (fetchAttempts < 3) {
      fetchAttempts++;
      try {
        const res = await fetch(url, { headers: bggHeaders });
        if (res.status === 429) { await sleep(fetchAttempts * 3000); continue; }
        if (res.status === 202) { await sleep(5000); continue; }
        if (!res.ok) { lastError = `HTTP ${res.status} for IDs ${ids[0]}-${ids[ids.length - 1]}`; totalErrors++; break; }
        xml = await res.text();
        break;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        if (fetchAttempts < 3) await sleep(2000);
      }
    }

    if (!xml) { totalErrors++; currentId += BATCH_SIZE; continue; }

    const games = parseBggItems(xml);

    if (games.length === 0 && newIds.length > 0) {
      const GAP_JUMP = 100;
      currentId += GAP_JUMP;
      totalSkipped += GAP_JUMP;
      continue;
    }

    for (const game of games) {
      if (existingIds.has(game.bggId)) { totalSkipped++; continue; }
      try {
        const { data: titleMatch } = await admin
          .from("game_catalog").select("id, description").eq("title", game.title).is("bgg_id", null).limit(1).maybeSingle();

        let entry: { id: string } | null = null;
        let upsertErr: any = null;

        if (titleMatch) {
          const typeCheckUpdateData: Record<string, any> = {
            bgg_id: game.bggId, bgg_verified_type: game.bggVerifiedType,
            image_url: game.imageUrl,
            min_players: game.minPlayers, max_players: game.maxPlayers,
            play_time_minutes: game.playTimeMinutes, suggested_age: game.suggestedAge,
            year_published: game.yearPublished, bgg_community_rating: game.bggCommunityRating,
            weight: game.weight, is_expansion: game.isExpansion, bgg_url: game.bggUrl,
          };
          if (!isDescriptionFormatted(titleMatch.description)) {
            typeCheckUpdateData.description = game.description;
          }
          const { data, error } = await admin.from("game_catalog").update(typeCheckUpdateData).eq("id", titleMatch.id).select("id").single();
          entry = data; upsertErr = error;
        } else {
          const { data, error } = await admin.from("game_catalog").upsert({
            bgg_id: game.bggId, bgg_verified_type: game.bggVerifiedType,
            title: game.title, description: game.description, image_url: game.imageUrl,
            min_players: game.minPlayers, max_players: game.maxPlayers,
            play_time_minutes: game.playTimeMinutes, suggested_age: game.suggestedAge,
            year_published: game.yearPublished, bgg_community_rating: game.bggCommunityRating,
            weight: game.weight, is_expansion: game.isExpansion, bgg_url: game.bggUrl,
          }, { onConflict: "bgg_id" }).select("id").single();
          entry = data; upsertErr = error;
        }

        if (upsertErr || !entry?.id) {
          totalErrors++;
          lastError = `Upsert failed for ${game.bggId}: ${upsertErr?.message}`;
          continue;
        }

        for (const mechName of game.mechanics) {
          const { data: mech } = await admin.from("mechanics").upsert({ name: mechName }, { onConflict: "name" }).select("id").single();
          if (mech?.id) await admin.from("catalog_mechanics").upsert({ catalog_id: entry.id, mechanic_id: mech.id }, { onConflict: "catalog_id,mechanic_id" });
        }
        if (game.publisher) {
          const { data: pub } = await admin.from("publishers").upsert({ name: game.publisher }, { onConflict: "name" }).select("id").single();
          if (pub?.id) await admin.from("catalog_publishers").upsert({ catalog_id: entry.id, publisher_id: pub.id }, { onConflict: "catalog_id,publisher_id" });
        }
        for (const name of game.designers) {
          const { data: d } = await admin.from("designers").upsert({ name }, { onConflict: "name" }).select("id").single();
          if (d?.id) await admin.from("catalog_designers").upsert({ catalog_id: entry.id, designer_id: d.id }, { onConflict: "catalog_id,designer_id" });
        }
        for (const name of game.artists) {
          const { data: a } = await admin.from("artists").upsert({ name }, { onConflict: "name" }).select("id").single();
          if (a?.id) await admin.from("catalog_artists").upsert({ catalog_id: entry.id, artist_id: a.id }, { onConflict: "catalog_id,artist_id" });
        }
        totalAdded++;
      } catch (e) {
        totalErrors++;
        lastError = `${game.bggId} (${game.title}): ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    currentId += BATCH_SIZE;
    if (batch < BATCHES_PER_RUN - 1) await sleep(1500);
  }

  const updatePayload = {
    next_bgg_id: currentId,
    total_processed: state.total_processed + (currentId - startBggId),
    total_added: state.total_added + totalAdded,
    total_skipped: state.total_skipped + totalSkipped,
    total_errors: state.total_errors + totalErrors,
    last_run_at: new Date().toISOString(),
    last_error: lastError,
    updated_at: new Date().toISOString(),
  };

  const { data: updateData, error: updateErr } = await admin
    .from("catalog_scraper_state")
    .upsert({ id: "default", ...updatePayload }, { onConflict: "id" })
    .select();

  if (updateErr || !updateData || updateData.length === 0) {
    try {
      const restUrl = `${supabaseUrl}/rest/v1/catalog_scraper_state?id=eq.default`;
      const patchResp = await fetch(restUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
          "Prefer": "return=representation",
        },
        body: JSON.stringify(updatePayload),
      });
      const patchBody = await patchResp.text();
      console.log(`[catalog-scraper] REST fallback: ${patchResp.status} ${patchBody.substring(0, 200)}`);
    } catch (restErr) {
      console.error(`[catalog-scraper] REST fallback also failed:`, restErr);
    }
  }

  const result = {
    success: true,
    bgg_id_range: `${startBggId}-${currentId - 1}`,
    added: totalAdded,
    skipped: totalSkipped,
    errors: totalErrors,
    next_bgg_id: currentId,
    last_error: lastError,
  };

  console.log(`[catalog-scraper] Done:`, JSON.stringify(result));

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};

export default handler;

if (import.meta.main) {
  Deno.serve(handler);
}
