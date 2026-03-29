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

    // Minimal filter: only skip entries that are PURELY non-board-game categories
    // with zero board game signals whatsoever
    const PURE_NON_BOARDGAME = ["Video Game", "Electronic"];
    const isPureNonBoardgame = categories.length > 0 && 
      categories.every(c => PURE_NON_BOARDGAME.includes(c)) && 
      mechanics.length === 0;
    
    if (isPureNonBoardgame) {
      console.log(`[catalog-scraper] Skipping BGG ID ${bggId} — non-board-game: "${title}" (categories: ${categories.join(", ")})`);
      continue;
    }

    // Ghost filter: only skip entries with NO title, NO image, NO description, AND 0 ratings
    // This catches truly empty placeholder IDs on BGG
    const usersRatedMatch = block.match(/<usersrated\s+value="([^"]+)"/);
    const usersRated = usersRatedMatch ? parseInt(usersRatedMatch[1]) || 0 : 0;
    const hasImage = !!imageMatch;
    const hasDescription = !!descMatch && descMatch[1].trim().length > 20;

    if (!hasImage && !hasDescription && usersRated === 0 && mechanics.length === 0 && title.length < 3) {
      console.log(`[catalog-scraper] Skipping BGG ID ${bggId} — ghost entry: "${title}"`);
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

async function syncDescriptionToLinkedGames(
  admin: ReturnType<typeof createClient>,
  entryId: string,
  bggId: string,
  description: string,
) {
  const trimmedDescription = description.trim();
  if (!trimmedDescription) return;

  const [catalogLinkedResult, bggLinkedResult] = await Promise.all([
    admin.from("games").update({ description: trimmedDescription }).eq("catalog_id", entryId),
    admin.from("games").update({ description: trimmedDescription }).eq("bgg_id", bggId),
  ]);

  if (catalogLinkedResult.error) {
    console.warn(`[fetch_ids] Failed syncing description by catalog_id for ${bggId}: ${catalogLinkedResult.error.message}`);
  }
  if (bggLinkedResult.error) {
    console.warn(`[fetch_ids] Failed syncing description by bgg_id for ${bggId}: ${bggLinkedResult.error.message}`);
  }
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
  // FIX-IMAGES — Batch fix catalog entries with missing or low-quality images
  // Fetches proper box art from BGG XML API <image> tag
  // =========================================================================
  if (action === "fix-images") {
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

    const batchLimit = body.limit || 100;

    // Find catalog entries that need image fixes
    const { data: badEntries, error: queryErr } = await admin
      .from("game_catalog")
      .select("id, bgg_id, title, image_url")
      .not("bgg_id", "is", null)
      .or("image_url.is.null,image_url.ilike.%__opengraph%,image_url.ilike.%fit-in/1200x630%")
      .limit(batchLimit);

    if (queryErr) {
      return new Response(JSON.stringify({ error: queryErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!badEntries || badEntries.length === 0) {
      // Check remaining count
      const { count: remaining } = await admin
        .from("game_catalog")
        .select("id", { count: "exact", head: true })
        .not("bgg_id", "is", null)
        .or("image_url.is.null,image_url.ilike.%__opengraph%,image_url.ilike.%fit-in/1200x630%");

      return new Response(JSON.stringify({ success: true, message: "No entries need fixing", fixed: 0, remaining: remaining || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[catalog-scraper] FIX-IMAGES: processing ${badEntries.length} entries`);

    let fixed = 0;
    let failed = 0;
    const results: { title: string; bgg_id: string; status: string; old_url?: string; new_url?: string }[] = [];

    // Process in chunks of 20 (BGG API batch limit)
    const CHUNK = 20;
    for (let i = 0; i < badEntries.length; i += CHUNK) {
      const chunk = badEntries.slice(i, i + CHUNK);
      const bggIds = chunk.map(e => e.bgg_id).filter(Boolean);
      if (bggIds.length === 0) continue;

      const idStr = bggIds.join(",");
      const url = `https://boardgamegeek.com/xmlapi2/thing?id=${idStr}&type=boardgame,boardgameexpansion`;

      let xml: string | null = null;
      let attempts = 0;
      while (attempts < 3 && !xml) {
        attempts++;
        try {
          const res = await fetch(url, { headers: bggHeaders });
          if (res.status === 202) { await sleep(5000); continue; }
          if (res.status === 429) { await sleep(attempts * 3000); continue; }
          if (res.ok) xml = await res.text();
          else { await res.text().catch(() => {}); break; }
        } catch { if (attempts < 3) await sleep(2000); }
      }

      if (!xml) {
        for (const entry of chunk) {
          failed++;
          results.push({ title: entry.title, bgg_id: entry.bgg_id, status: "fetch_failed" });
        }
        continue;
      }

      // Build a map of bgg_id -> image_url from the XML response
      const imageMap = new Map<string, string>();
      const itemRegex = /<item[^>]*id="(\d+)"[^>]*>([\s\S]*?)<\/item>/g;
      let itemMatch;
      while ((itemMatch = itemRegex.exec(xml)) !== null) {
        const itemBggId = itemMatch[1];
        const block = itemMatch[2];
        const imgMatch = block.match(/<image>([^<]+)<\/image>/);
        if (imgMatch?.[1]) {
          const imgUrl = imgMatch[1].trim();
          // Reject opengraph/cropped variants
          if (!/__opengraph|fit-in\/1200x630|__small|__thumb|__micro/i.test(imgUrl)) {
            imageMap.set(itemBggId, imgUrl);
          }
        }
      }

      // Update each entry
      for (const entry of chunk) {
        const newImageUrl = imageMap.get(entry.bgg_id);
        if (newImageUrl) {
          const { error: updateErr } = await admin
            .from("game_catalog")
            .update({ image_url: newImageUrl })
            .eq("id", entry.id);

          if (updateErr) {
            failed++;
            results.push({ title: entry.title, bgg_id: entry.bgg_id, status: "update_failed" });
          } else {
            fixed++;
            results.push({ title: entry.title, bgg_id: entry.bgg_id, status: "fixed", old_url: entry.image_url, new_url: newImageUrl });

            // Cascade: also fix any library games linked to this catalog entry or bgg_id
            await admin
              .from("games")
              .update({ image_url: newImageUrl })
              .eq("bgg_id", entry.bgg_id)
              .or("image_url.is.null,image_url.ilike.%__opengraph%,image_url.ilike.%fit-in/1200x630%");
          }
        } else {
          failed++;
          results.push({ title: entry.title, bgg_id: entry.bgg_id, status: "no_image_in_xml" });
        }
      }

      // Be nice to BGG API
      if (i + CHUNK < badEntries.length) await sleep(1500);
    }

    // Count remaining
    const { count: remaining } = await admin
      .from("game_catalog")
      .select("id", { count: "exact", head: true })
      .not("bgg_id", "is", null)
      .or("image_url.is.null,image_url.ilike.%__opengraph%,image_url.ilike.%fit-in/1200x630%");

    const response = {
      success: true,
      mode: "fix-images",
      processed: badEntries.length,
      fixed,
      failed,
      remaining: remaining || 0,
      results,
    };

    console.log(`[catalog-scraper] FIX-IMAGES complete: fixed=${fixed}, failed=${failed}, remaining=${remaining}`);

    return new Response(JSON.stringify(response), {
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
          let entryId: string | null = null;
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
              weight: game.weight,
              is_expansion: game.isExpansion,
              bgg_url: game.bggUrl,
            };
            // Only overwrite description if not already AI-formatted
            if (!isDescriptionFormatted(existing.description)) {
              updateData.description = game.description;
            }
            await admin.from("game_catalog").update(updateData).eq("id", existing.id);
            // Fall through to enrichment using existing entry ID
            entryId = existing.id;
            totalSkipped++;
          }

          let wasUpdate = !!entryId;

          if (!entryId) {
          // Check for NULL-bgg_id title match
          const { data: titleMatch } = await admin
            .from("game_catalog").select("id, description").eq("title", game.title).is("bgg_id", null).limit(1).maybeSingle();
          if (titleMatch) {
            const titleUpdateData: Record<string, any> = {
              bgg_id: game.bggId, image_url: game.imageUrl,
              min_players: game.minPlayers, max_players: game.maxPlayers, play_time_minutes: game.playTimeMinutes,
              suggested_age: game.suggestedAge, year_published: game.yearPublished,
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
              is_expansion: game.isExpansion, bgg_url: game.bggUrl,
            }, { onConflict: "bgg_id" }).select("id").single();
            entryId = data?.id || null;
          }
          } // end if (!entryId)

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

            // ---- AI Description Condensing ----
            try {
              // Always check the current DB description — it may already be formatted from a previous run
              const { data: descCheck } = await admin.from("game_catalog").select("description").eq("id", entryId).single();
              const dbDesc = descCheck?.description || "";
              const rawDesc = game.description || "";
              // Use raw BGG description as source material, but only condense if DB isn't already formatted
              const sourceDesc = rawDesc.length > dbDesc.length ? rawDesc : dbDesc;
              if (sourceDesc && sourceDesc.length >= 100 && !isDescriptionFormatted(dbDesc)) {
                console.log(`[fetch_ids] Condensing description for "${game.title}" (${sourceDesc.length} chars)...`);
                const cortexUrl = Deno.env.get("CORTEX_BASE_URL") || "https://cortex.tzolak.com/api/lmstudio";
                const descCtrl = new AbortController();
                const descTimer = setTimeout(() => descCtrl.abort(), 45000);
                const descRes = await fetch(cortexUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    messages: [
                      { role: "system", content: `You condense board game descriptions into a specific template. Output ONLY the condensed description, no commentary.

TEMPLATE (follow exactly):
[2-3 sentence intro about the game theme and what makes it special]

## Quick Gameplay Overview

- **Goal:** [one sentence]
- **On Your Turn:** [or "Each Round:"]
  - [action 1 - one line]
  - [action 2 - one line]
  - [action 3 - one line]
- **End Game:** [one sentence]
- **Winner:** [one sentence]

[Optional: one closing sentence about edition/components]

EXAMPLE OUTPUT:
Taco Cat Goat Cheese Pizza unleashes reactive chaos for 2-8 as players flip cards chanting a mantra, slapping word-image matches amid gesture specials. Fast reflexes and penalties drive hilarious pile-grabbing frenzy.

## Quick Gameplay Overview

- **Goal:** Shed cards first by slapping correctly.
- **On Your Turn:**
  - Flip card, say next word (taco-cat-goat-cheese-pizza).
  - Gesture on specials; slap matches.
  - Misses take pile.
- **End Game:** One out and slaps.
- **Winner:** First cardless slapper.

RULES: Max 150-200 words total. Each bullet ONE line max. No verbose explanations. Use markdown formatting exactly as shown.` },
                      { role: "user", content: `Condense for "${game.title}":\n\n${sourceDesc.slice(0, 3000)}` }
                    ],
                    max_tokens: 600,
                  }),
                  signal: descCtrl.signal,
                });
                clearTimeout(descTimer);
                if (descRes.ok) {
                  const descData = await descRes.json();
                  const condensed = descData?.choices?.[0]?.message?.content?.trim();
                  if (condensed && condensed.length > 50 && condensed.includes("Quick Gameplay Overview")) {
                    await admin.from("game_catalog").update({ description: condensed }).eq("id", entryId);
                    await syncDescriptionToLinkedGames(admin, entryId, game.bggId, condensed);
                    console.log(`[fetch_ids] ✓ Condensed description for "${game.title}" (${sourceDesc.length} → ${condensed.length} chars) and synced to linked games`);
                  } else {
                    console.warn(`[fetch_ids] Condensed output didn't match template for "${game.title}", skipping`);
                  }
                } else {
                  console.warn(`[fetch_ids] Cortex returned ${descRes.status} for description condensing`);
                }
              } else if (isDescriptionFormatted(dbDesc)) {
                await syncDescriptionToLinkedGames(admin, entryId, game.bggId, dbDesc);
                console.log(`[fetch_ids] Description already formatted for "${game.title}", synced to linked games`);
              }
            } catch (descErr) {
              console.warn(`[fetch_ids] Description condensing failed for "${game.title}":`, descErr instanceof Error ? descErr.message : descErr);
            }

            // ---- AI Genre Classification ----
            try {
              const cortexUrl = Deno.env.get("CORTEX_BASE_URL") || "https://cortex.tzolak.com/api/lmstudio";
              const VALID_GENRES = ["Fantasy","Sci-Fi","Historical","Horror","Mystery","Adventure","Strategy","Abstract","Humor","Nature","War","Political","Party","Trivia","Sports","Educational","Cooperative","Family","Deck Building","Other"];
              const genreCtrl = new AbortController();
              const genreTimer = setTimeout(() => genreCtrl.abort(), 15000);
              const genreRes = await fetch(cortexUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  messages: [
                    { role: "system", content: `Classify board games into 1-3 genres from: ${VALID_GENRES.join(", ")}. Reply ONLY with JSON: {"genres":["Genre1","Genre2"]}. Rules: Economic→Strategy. Journey/travel→Adventure. Gateway games→Strategy. Cooperative only if major defining feature.` },
                    { role: "user", content: `"${game.title}" - Mechanics: ${game.mechanics.join(", ") || "none"}. Desc: ${(game.description || "").slice(0, 500)}` }
                  ],
                  temperature: 0.1, max_tokens: 100,
                }),
                signal: genreCtrl.signal,
              });
              clearTimeout(genreTimer);
              if (genreRes.ok) {
                const genreData = await genreRes.json();
                const content = genreData?.choices?.[0]?.message?.content || "";
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const parsed = JSON.parse(jsonMatch[0]);
                  const aiGenres = (parsed.genres || []).filter((g: string) => VALID_GENRES.includes(g)).slice(0, 3);
                  if (aiGenres.length > 0) {
                    await admin.from("catalog_genres").delete().eq("catalog_id", entryId);
                    const genreRows = aiGenres.map((g: string, idx: number) => ({ catalog_id: entryId, genre: g, display_order: idx }));
                    await admin.from("catalog_genres").insert(genreRows);
                    await admin.from("game_catalog").update({ genre: aiGenres[0] }).eq("id", entryId);
                    console.log(`[fetch_ids] AI Genres for "${game.title}": ${aiGenres.join(", ")}`);
                  }
                }
              }
            } catch (genreErr) {
              console.warn(`[fetch_ids] AI genre classification failed for "${game.title}":`, genreErr);
              // Fallback to basic heuristic
              const corpus = `${game.title} ${game.description || ""}`.toLowerCase();
              const fallbackGenre = corpus.includes("fantasy") ? "Fantasy" : corpus.includes("sci-fi") || corpus.includes("space") ? "Sci-Fi" : corpus.includes("war") || corpus.includes("battle") ? "War" : "Strategy";
              await admin.from("catalog_genres").delete().eq("catalog_id", entryId);
              await admin.from("catalog_genres").insert([{ catalog_id: entryId, genre: fallbackGenre, display_order: 0 }]);
              await admin.from("game_catalog").update({ genre: fallbackGenre }).eq("id", entryId);
              console.log(`[fetch_ids] Fallback genre for "${game.title}": ${fallbackGenre}`);
            }

            // ---- Ensure mechanic family resolution ----
            // For any newly upserted mechanics that lack a family_id, try to resolve via mechanic_families
            try {
              const { data: unfamilied } = await admin
                .from("mechanics")
                .select("id, name")
                .is("family_id", null)
                .in("name", game.mechanics);
              if (unfamilied && unfamilied.length > 0) {
                console.log(`[fetch_ids] ${unfamilied.length} mechanics without family for "${game.title}", attempting Cortex resolution`);
                // Load family names for matching
                const { data: families } = await admin.from("mechanic_families").select("id, name");
                if (families && families.length > 0) {
                  const cortexUrl = Deno.env.get("CORTEX_BASE_URL") || "https://cortex.tzolak.com/api/lmstudio";
                  const familyNames = families.map(f => f.name);
                  const prompt = `Classify these board game mechanics into families. Mechanics: ${unfamilied.map(m => m.name).join(", ")}. Families: ${familyNames.join(", ")}. Reply ONLY with JSON: {"mappings":[{"mechanic":"name","family":"family_name"}]}`;
                  try {
                    const ctrl = new AbortController();
                    const timer = setTimeout(() => ctrl.abort(), 15000);
                    const cortexRes = await fetch(cortexUrl, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        model: "qwen2.5-14b-instruct",
                        messages: [{ role: "user", content: prompt }],
                        temperature: 0.1, max_tokens: 500,
                      }),
                      signal: ctrl.signal,
                    });
                    clearTimeout(timer);
                    if (cortexRes.ok) {
                      const cortexData = await cortexRes.json();
                      const content = cortexData?.choices?.[0]?.message?.content || "";
                      const jsonMatch = content.match(/\{[\s\S]*\}/);
                      if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        const mappings = parsed.mappings || [];
                        const familyLookup = new Map(families.map(f => [f.name.toLowerCase(), f.id]));
                        for (const m of mappings) {
                          const familyId = familyLookup.get(m.family?.toLowerCase());
                          if (familyId) {
                            const mechRow = unfamilied.find(u => u.name.toLowerCase() === m.mechanic?.toLowerCase());
                            if (mechRow) {
                              await admin.from("mechanics").update({ family_id: familyId }).eq("id", mechRow.id);
                              console.log(`[fetch_ids] Mapped mechanic "${mechRow.name}" → family "${m.family}"`);
                            }
                          }
                        }
                      }
                    }
                  } catch (cortexErr) {
                    console.warn(`[fetch_ids] Cortex mechanic family resolution failed:`, cortexErr);
                  }
                }
              }
            } catch (mechFamErr) {
              console.warn(`[fetch_ids] Mechanic family check failed:`, mechFamErr);
            }

            results.push({ bgg_id: Number(game.bggId), title: game.title, status: wasUpdate ? "updated" : "added" });
            if (!wasUpdate) totalAdded++;
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
  // =========================================================================
  // GAP_FILL — Re-scan a range of BGG IDs to catch anything previously missed
  // Usage: { "action": "gap_fill", "start": 380000, "end": 390000 }
  // Will check each ID in the range and fetch any not already in the catalog
  // =========================================================================
  if (action === "gap_fill") {
    const startId = Number(body.start) || 1;
    const endId = Number(body.end) || startId + 10000;
    const BATCH_SIZE = 20;
    const maxBatches = Math.ceil((endId - startId) / BATCH_SIZE);

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

    let currentId = startId;
    let totalAdded = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let lastError: string | null = null;

    console.log(`[catalog-scraper] GAP_FILL: scanning ${startId}–${endId} (${maxBatches} batches)`);

    for (let batch = 0; batch < maxBatches && currentId < endId; batch++) {
      const batchEnd = Math.min(currentId + BATCH_SIZE, endId);
      const ids = Array.from({ length: batchEnd - currentId }, (_, i) => currentId + i);

      // Check which IDs already exist
      const { data: existing } = await admin
        .from("game_catalog")
        .select("bgg_id")
        .in("bgg_id", ids.map(String));
      const existingIds = new Set((existing || []).map(e => e.bgg_id));

      const missingIds = ids.filter(id => !existingIds.has(String(id)));
      if (missingIds.length === 0) {
        totalSkipped += ids.length;
        currentId = batchEnd;
        continue;
      }

      // Fetch only missing IDs from BGG
      const url = `https://boardgamegeek.com/xmlapi2/thing?id=${missingIds.join(",")}&type=boardgame,boardgameexpansion&stats=1`;
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

      if (!xml) { totalErrors++; currentId = batchEnd; continue; }

      const games = parseBggItems(xml);

      for (const game of games) {
        if (existingIds.has(game.bggId)) { totalSkipped++; continue; }
        try {
          const { data: entry } = await admin.from("game_catalog").upsert({
            bgg_id: game.bggId, bgg_verified_type: game.bggVerifiedType,
            title: game.title, description: game.description, image_url: game.imageUrl,
            min_players: game.minPlayers, max_players: game.maxPlayers,
            play_time_minutes: game.playTimeMinutes, suggested_age: game.suggestedAge,
            year_published: game.yearPublished,
            weight: game.weight, is_expansion: game.isExpansion, bgg_url: game.bggUrl,
          }, { onConflict: "bgg_id" }).select("id").single();

          if (entry?.id) {
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
            console.log(`[gap_fill] Added: ${game.title} (BGG ${game.bggId})`);
          }
        } catch (e) {
          totalErrors++;
          lastError = `${game.bggId}: ${e instanceof Error ? e.message : String(e)}`;
        }
      }

      totalSkipped += missingIds.length - games.filter(g => !existingIds.has(g.bggId)).length;
      currentId = batchEnd;
      if (batch < maxBatches - 1) await sleep(1500);
    }

    console.log(`[catalog-scraper] GAP_FILL complete: added=${totalAdded}, skipped=${totalSkipped}, errors=${totalErrors}`);
    return new Response(JSON.stringify({
      success: true, action: "gap_fill",
      range: `${startId}–${endId}`,
      added: totalAdded, skipped: totalSkipped, errors: totalErrors,
      last_error: lastError,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // =========================================================================
  // SWEEP — Weekly forward scan for new BGG entries
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
              year_published: game.yearPublished,
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
              year_published: game.yearPublished,
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
  const MAX_BGG_ID_CEILING = 500000; // Wrap around after this
  const startBggId = state.next_bgg_id;
  let currentId = startBggId;
  let totalAdded = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let lastError: string | null = null;
  let firstNewGameBggId: number | null = null; // Track where we first found a new game
  let consecutiveEmptyBatches = 0;
  const MAX_CONSECUTIVE_EMPTY = 50; // Stop after 50 empty batches (1000 IDs)

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
      consecutiveEmptyBatches++;
      // If we've hit too many consecutive empty batches, stop early
      if (consecutiveEmptyBatches >= MAX_CONSECUTIVE_EMPTY) {
        console.log(`[catalog-scraper] ${MAX_CONSECUTIVE_EMPTY} consecutive empty batches, stopping early`);
        break;
      }
      continue;
    }

    // Reset empty counter when we find IDs to process
    consecutiveEmptyBatches = 0;

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

    if (games.length === 0) {
      // No gap jumping — just move to next batch normally
      // Games may exist at these IDs but BGG returned empty (202, timeout, etc.)
      currentId += BATCH_SIZE;
      totalSkipped += BATCH_SIZE;
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
            year_published: game.yearPublished,
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
            year_published: game.yearPublished,
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
        // Track the first BGG ID where we found a genuinely new game
        const gameBggIdNum = parseInt(game.bggId, 10);
        if (firstNewGameBggId === null || gameBggIdNum < firstNewGameBggId) {
          firstNewGameBggId = gameBggIdNum;
        }
      } catch (e) {
        totalErrors++;
        lastError = `${game.bggId} (${game.title}): ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    currentId += BATCH_SIZE;
    if (batch < BATCHES_PER_RUN - 1) await sleep(1500);
  }

  // Smart position logic:
  // - If we found new games, anchor next_bgg_id to just after the last new game found
  //   so subsequent runs continue from where real data exists
  // - If no new games found and we've gone past the ceiling, wrap around to 1
  // - Otherwise just continue from where we left off
  let finalNextBggId: number;
  if (totalAdded > 0) {
    // Continue from where we are — the new games anchor the position
    finalNextBggId = currentId;
    console.log(`[catalog-scraper] Found ${totalAdded} new games, continuing from ${finalNextBggId}`);
  } else if (currentId >= MAX_BGG_ID_CEILING) {
    // We've scanned past the ceiling with no new finds — wrap to start
    finalNextBggId = 1;
    console.log(`[catalog-scraper] Reached ceiling ${MAX_BGG_ID_CEILING} with no new games, wrapping to BGG ID 1`);
  } else {
    finalNextBggId = currentId;
  }

  const updatePayload = {
    next_bgg_id: finalNextBggId,
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
    next_bgg_id: finalNextBggId,
    wrapped: finalNextBggId < currentId,
    first_new_game_bgg_id: firstNewGameBggId,
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
