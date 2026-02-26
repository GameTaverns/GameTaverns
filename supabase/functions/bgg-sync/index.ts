import { createClient } from "npm:@supabase/supabase-js@2";
import { withLogging } from "../_shared/system-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// BGG XML Helpers
// ============================================================================

/**
 * All BGG collection status flags as returned by the XML API <status> element.
 */
interface BGGCollectionItem {
  bgg_id: string;
  name: string;
  image_url?: string;
  thumbnail_url?: string;
  year_published?: string;
  min_players?: number;
  max_players?: number;
  playing_time?: number;
  is_expansion: boolean;
  // Status flags — mirrors BGG's <status> attributes
  status_own: boolean;
  status_prevowned: boolean;
  status_fortrade: boolean;
  status_want: boolean;
  status_wanttobuy: boolean;
  status_wanttoplay: boolean;
  status_wishlist: boolean;
  status_preordered: boolean;
}

function parseBGGCollectionXML(xml: string): BGGCollectionItem[] {
  const items: BGGCollectionItem[] = [];

  const itemRegex = /<item\s+([^>]*)>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const content = match[2];

    const objectId = attrs.match(/objectid="(\d+)"/)?.[1];
    const subtype = attrs.match(/subtype="([^"]+)"/)?.[1] || "";
    if (!objectId) continue;

    const nameMatch = content.match(/<name[^>]*>([^<]+)<\/name>/);
    const name = nameMatch?.[1] || "Unknown";

    const imageMatch = content.match(/<image>([^<]+)<\/image>/);
    const thumbnailMatch = content.match(/<thumbnail>([^<]+)<\/thumbnail>/);
    const yearMatch = content.match(/<yearpublished>(\d+)<\/yearpublished>/);
    const minPlayersMatch = content.match(/<stats[^>]*minplayers="(\d+)"/);
    const maxPlayersMatch = content.match(/<stats[^>]*maxplayers="(\d+)"/);
    const playingTimeMatch = content.match(/<stats[^>]*playingtime="(\d+)"/);

    // Parse ALL status flags
    const statusMatch = content.match(/<status\s+([^/]*)\/?>/);
    const s = statusMatch?.[1] || "";

    items.push({
      bgg_id: objectId,
      name,
      image_url: imageMatch?.[1],
      thumbnail_url: thumbnailMatch?.[1],
      year_published: yearMatch?.[1],
      min_players: minPlayersMatch ? parseInt(minPlayersMatch[1], 10) : undefined,
      max_players: maxPlayersMatch ? parseInt(maxPlayersMatch[1], 10) : undefined,
      playing_time: playingTimeMatch ? parseInt(playingTimeMatch[1], 10) : undefined,
      is_expansion: subtype === "boardgameexpansion",
      status_own: s.includes('own="1"'),
      status_prevowned: s.includes('prevowned="1"'),
      status_fortrade: s.includes('fortrade="1"'),
      status_want: s.includes('want="1"'),
      status_wanttobuy: s.includes('wanttobuy="1"'),
      status_wanttoplay: s.includes('wanttoplay="1"'),
      status_wishlist: s.includes('wishlist="1"'),
      status_preordered: s.includes('preordered="1"'),
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Fetch proper high-quality image from BGG thing XML API
// ---------------------------------------------------------------------------
async function fetchThingImage(bggId: string): Promise<string | null> {
  const bggCookie = Deno.env.get("BGG_SESSION_COOKIE") || Deno.env.get("BGG_COOKIE") || "";
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/xml",
  };
  if (bggCookie) headers["Cookie"] = bggCookie;

  const xmlUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${bggId}`;
  try {
    const res = await fetch(xmlUrl, { headers });
    if (!res.ok) return null;
    const xml = await res.text();
    const imageMatch = xml.match(/<image>([^<]+)<\/image>/);
    return imageMatch?.[1] || null;
  } catch (_e) {
    return null;
  }
}

function isLowQualityBggImage(url: string | undefined): boolean {
  if (!url) return true;
  return /__opengraph|fit-in\/1200x630|filters:strip_icc|__thumb|__micro/i.test(url);
}

/**
 * Fetch a single BGG collection page with retry on 202.
 */
async function fetchBGGCollectionPage(url: string): Promise<BGGCollectionItem[]> {
  const bggToken = Deno.env.get("BGG_API_TOKEN") || "";
  const bggCookie = Deno.env.get("BGG_SESSION_COOKIE") || Deno.env.get("BGG_COOKIE") || "";

  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/xml",
    Referer: "https://boardgamegeek.com/",
    Origin: "https://boardgamegeek.com",
  };

  if (bggToken) headers["Authorization"] = `Bearer ${bggToken}`;
  if (bggCookie) headers["Cookie"] = bggCookie;

  let attempts = 0;
  while (attempts < 6) {
    const res = await fetch(url, { headers });

    if (res.status === 202) {
      console.log("[BGGSync] BGG returned 202, waiting...");
      await new Promise((r) => setTimeout(r, 3000));
      attempts++;
      continue;
    }

    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 200);
      throw new Error(`BGG API error ${res.status}: ${body}`);
    }

    const xml = await res.text();
    return parseBGGCollectionXML(xml);
  }

  throw new Error("BGG collection request timed out after retries");
}

/**
 * Fetch ALL collection items across all BGG status types.
 * Each status type needs its own fetch because the BGG API filters by flag.
 * We merge them with priority: owned > prevowned > fortrade > preordered > wishlist/want.
 */
async function fetchFullBGGCollection(
  username: string,
): Promise<BGGCollectionItem[]> {
  const enc = encodeURIComponent(username);
  const base = `https://boardgamegeek.com/xmlapi2/collection?username=${enc}&stats=1`;
  const delay = () => new Promise((r) => setTimeout(r, 1500));

  // Fetch each status separately — BGG requires this
  console.log(`[BGGSync] Fetching owned items...`);
  const owned = await fetchBGGCollectionPage(`${base}&own=1`);
  console.log(`[BGGSync] Fetched ${owned.length} owned items`);

  await delay();
  console.log(`[BGGSync] Fetching previously owned items...`);
  const prevOwned = await fetchBGGCollectionPage(`${base}&prevowned=1`);
  console.log(`[BGGSync] Fetched ${prevOwned.length} previously owned items`);

  await delay();
  console.log(`[BGGSync] Fetching for-trade items...`);
  const forTrade = await fetchBGGCollectionPage(`${base}&trade=1`);
  console.log(`[BGGSync] Fetched ${forTrade.length} for-trade items`);

  await delay();
  console.log(`[BGGSync] Fetching preordered items...`);
  const preordered = await fetchBGGCollectionPage(`${base}&preordered=1`);
  console.log(`[BGGSync] Fetched ${preordered.length} preordered items`);

  await delay();
  console.log(`[BGGSync] Fetching wishlist items...`);
  const wishlist = await fetchBGGCollectionPage(`${base}&wishlist=1`);
  console.log(`[BGGSync] Fetched ${wishlist.length} wishlist items`);

  await delay();
  console.log(`[BGGSync] Fetching want-to-buy items...`);
  const wantToBuy = await fetchBGGCollectionPage(`${base}&wanttobuy=1`);
  console.log(`[BGGSync] Fetched ${wantToBuy.length} want-to-buy items`);

  await delay();
  console.log(`[BGGSync] Fetching want-in-trade items...`);
  const wantInTrade = await fetchBGGCollectionPage(`${base}&want=1`);
  console.log(`[BGGSync] Fetched ${wantInTrade.length} want-in-trade items`);

  await delay();
  console.log(`[BGGSync] Fetching want-to-play items...`);
  const wantToPlay = await fetchBGGCollectionPage(`${base}&wanttoplay=1`);
  console.log(`[BGGSync] Fetched ${wantToPlay.length} want-to-play items`);

  // Merge — keep first occurrence (priority order determines primary status)
  const seen = new Set<string>();
  const all: BGGCollectionItem[] = [];

  // Priority: owned first, then for-trade, prevowned, preordered, then wants
  for (const batch of [owned, forTrade, prevOwned, preordered, wantInTrade, wantToBuy, wishlist, wantToPlay]) {
    for (const item of batch) {
      if (!seen.has(item.bgg_id)) {
        seen.add(item.bgg_id);
        all.push(item);
      }
    }
  }

  console.log(`[BGGSync] Total unique items: ${all.length}`);
  return all;
}

/**
 * Determine the primary platform action for a BGG item based on its status flags.
 * Returns: "owned" | "previously_owned" | "for_trade" | "preordered" | "wishlist" | "want_to_play" | "skip"
 */
function determinePlatformAction(item: BGGCollectionItem): string {
  // Owned items (may also be for_trade)
  if (item.status_own) {
    if (item.status_fortrade) return "for_trade"; // owned + listed for trade
    if (item.status_preordered) return "preordered"; // preordered (coming soon)
    return "owned";
  }
  // Not currently owned
  if (item.status_prevowned) return "previously_owned";
  if (item.status_fortrade) return "for_trade"; // rare edge: for trade but not owned
  if (item.status_preordered) return "preordered";
  // Want/wishlist items → trade wants
  if (item.status_want || item.status_wanttobuy || item.status_wishlist) return "wishlist";
  if (item.status_wanttoplay) return "want_to_play";
  return "skip";
}

// ============================================================================
// Sync Logic
// ============================================================================

interface SyncResult {
  added: number;
  updated: number;
  flagged: number;
  removed: number;
  skipped: number;
  errors: string[];
  plays_imported?: number;
  wishlist_added?: number;
  trade_listed?: number;
  previously_owned_added?: number;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
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
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Parse request
    const body = await req.json().catch(() => null);
    const { library_id } = body || {};

    if (!library_id) {
      return new Response(JSON.stringify({ success: false, error: "library_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership
    const { data: library } = await supabaseAdmin
      .from("libraries")
      .select("id, owner_id")
      .eq("id", library_id)
      .single();

    if (!library || library.owner_id !== userId) {
      // Also check admin role for cron-triggered syncs
      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ success: false, error: "Only library owners can sync" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get sync config from library_settings
    const { data: settings } = await supabaseAdmin
      .from("library_settings")
      .select(
        "bgg_username, bgg_sync_removal_behavior, bgg_sync_collection, bgg_sync_plays, bgg_sync_wishlist",
      )
      .eq("library_id", library_id)
      .single();

    if (!settings?.bgg_username) {
      await supabaseAdmin
        .from("library_settings")
        .update({
          bgg_last_synced_at: new Date().toISOString(),
          bgg_last_sync_status: "error",
          bgg_last_sync_message: "No BGG username configured",
        })
        .eq("library_id", library_id);

      return new Response(
        JSON.stringify({ success: false, error: "No BGG username configured. Set it in Library Settings → BGG Sync." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const bggUsername = settings.bgg_username;
    const removalBehavior = settings.bgg_sync_removal_behavior || "flag";
    const syncCollection = settings.bgg_sync_collection !== false;
    const syncPlays = settings.bgg_sync_plays === true;
    const syncWishlist = settings.bgg_sync_wishlist === true;

    console.log(
      `[BGGSync] Starting sync for library ${library_id}, BGG user: ${bggUsername}, removal: ${removalBehavior}, plays: ${syncPlays}, wishlist: ${syncWishlist}`,
    );

    const result: SyncResult = {
      added: 0,
      updated: 0,
      flagged: 0,
      removed: 0,
      skipped: 0,
      errors: [],
    };

    // ======================================================================
    // 1. Collection sync — fetch ALL BGG statuses
    // ======================================================================
    if (syncCollection) {
      try {
        const bggItems = await fetchFullBGGCollection(bggUsername);
        console.log(`[BGGSync] Fetched ${bggItems.length} total items from BGG`);

        // Get all existing games in this library
        const { data: existingGames } = await supabaseAdmin
          .from("games")
          .select("id, title, bgg_id, is_coming_soon, ownership_status, is_for_sale")
          .eq("library_id", library_id);

        const existingByBggId = new Map<string, { id: string; title: string; is_coming_soon: boolean; ownership_status: string; is_for_sale: boolean }>();
        const existingByTitle = new Map<string, { id: string; bgg_id: string | null; is_coming_soon: boolean; ownership_status: string; is_for_sale: boolean }>();

        for (const g of existingGames || []) {
          if (g.bgg_id) existingByBggId.set(g.bgg_id, { id: g.id, title: g.title, is_coming_soon: g.is_coming_soon, ownership_status: g.ownership_status || "owned", is_for_sale: g.is_for_sale || false });
          existingByTitle.set(g.title.toLowerCase(), { id: g.id, bgg_id: g.bgg_id, is_coming_soon: g.is_coming_soon, ownership_status: g.ownership_status || "owned", is_for_sale: g.is_for_sale || false });
        }

        const bggIdsSeen = new Set<string>();

        // Process each BGG item
        for (const item of bggItems) {
          bggIdsSeen.add(item.bgg_id);
          const action = determinePlatformAction(item);

          if (action === "skip") {
            result.skipped++;
            continue;
          }

          // Wishlist items (want, wanttobuy, wishlist) → trade_wants, NOT the game library
          if (action === "wishlist") {
            if (syncWishlist) {
              try {
                const { data: existingWant } = await supabaseAdmin
                  .from("trade_wants")
                  .select("id")
                  .eq("user_id", userId)
                  .eq("bgg_id", item.bgg_id)
                  .maybeSingle();

                if (!existingWant) {
                  const { error: insertErr } = await supabaseAdmin
                    .from("trade_wants")
                    .insert({
                      user_id: userId,
                      bgg_id: item.bgg_id,
                      game_title: item.name,
                      notes: "Imported from BGG wishlist",
                    });
                  if (!insertErr) {
                    result.wishlist_added = (result.wishlist_added || 0) + 1;
                  }
                }
              } catch (_e) {
                // trade_wants table may not exist in all environments
                console.warn(`[BGGSync] Could not add wishlist item "${item.name}" — trade_wants table may not exist`);
              }
            }
            continue; // Don't add to game library
          }

          // Want to play → don't import into library (user hasn't played or owned it)
          if (action === "want_to_play") {
            result.skipped++;
            continue;
          }

          // Determine ownership_status and flags for library games
          let ownershipStatus = "owned";
          let isComingSoon = false;
          let isForSale = false;

          if (action === "previously_owned") ownershipStatus = "previously_owned";
          if (action === "preordered") { ownershipStatus = "owned"; isComingSoon = true; }
          if (action === "for_trade") { ownershipStatus = "owned"; isForSale = true; }

          const existing = existingByBggId.get(item.bgg_id) ||
            existingByTitle.get(item.name.toLowerCase());

          if (existing) {
            // Game exists - update metadata if needed
            const updates: Record<string, unknown> = {};

            if (!existingByBggId.has(item.bgg_id) && existingByTitle.has(item.name.toLowerCase())) {
              updates.bgg_id = item.bgg_id;
              updates.bgg_url = `https://boardgamegeek.com/boardgame/${item.bgg_id}`;
            }

            // Update image if current one is low quality
            if (item.image_url && !existing.is_coming_soon) {
              if (isLowQualityBggImage(item.image_url)) {
                const betterImage = await fetchThingImage(item.bgg_id);
                if (betterImage) updates.image_url = betterImage;
                await new Promise(r => setTimeout(r, 200));
              } else {
                updates.image_url = item.image_url;
              }
            }
            if (item.min_players) updates.min_players = item.min_players;
            if (item.max_players) updates.max_players = item.max_players;

            // Update ownership status
            if (existing.ownership_status !== ownershipStatus) {
              updates.ownership_status = ownershipStatus;
            }

            // Update coming soon flag
            if (existing.is_coming_soon !== isComingSoon) {
              updates.is_coming_soon = isComingSoon;
            }

            if (Object.keys(updates).length > 0) {
              const { error } = await supabaseAdmin
                .from("games")
                .update(updates)
                .eq("id", existing.id);
              if (error) {
                result.errors.push(`Update ${item.name}: ${error.message}`);
              } else {
                result.updated++;
              }
            } else {
              result.skipped++;
            }

            // Handle for-trade: create trade listing if not already listed
            if (action === "for_trade") {
              try {
                const { data: existingListing } = await supabaseAdmin
                  .from("trade_listings")
                  .select("id")
                  .eq("user_id", userId)
                  .eq("game_id", existing.id)
                  .maybeSingle();

                if (!existingListing) {
                  const { error: tradeErr } = await supabaseAdmin
                    .from("trade_listings")
                    .insert({
                      user_id: userId,
                      game_id: existing.id,
                      library_id,
                      condition: "Good",
                      notes: "Imported from BGG for-trade list",
                    });
                  if (!tradeErr) {
                    result.trade_listed = (result.trade_listed || 0) + 1;
                  }
                }
              } catch (_e) {
                console.warn(`[BGGSync] Could not create trade listing for "${item.name}" — trade_listings table may not exist`);
              }
            }
          } else {
            // New game — add it
            let imageUrl = item.image_url || item.thumbnail_url || null;
            if (isLowQualityBggImage(imageUrl)) {
              const betterImage = await fetchThingImage(item.bgg_id);
              if (betterImage) imageUrl = betterImage;
              await new Promise(r => setTimeout(r, 200));
            }

            // Try to match to catalog for richer metadata
            let catalogId: string | null = null;
            const { data: catalogMatch } = await supabaseAdmin
              .from("game_catalog")
              .select("id")
              .eq("bgg_id", item.bgg_id)
              .maybeSingle();
            if (catalogMatch) catalogId = catalogMatch.id;

            const insertData: Record<string, unknown> = {
              title: item.name,
              bgg_id: item.bgg_id,
              bgg_url: `https://boardgamegeek.com/boardgame/${item.bgg_id}`,
              image_url: imageUrl,
              min_players: item.min_players || null,
              max_players: item.max_players || null,
              is_expansion: item.is_expansion,
              is_coming_soon: isComingSoon,
              ownership_status: ownershipStatus,
              library_id,
            };
            if (catalogId) insertData.catalog_id = catalogId;

            // Try to match expansion to parent game
            if (item.is_expansion) {
              // We'll attempt parent matching after insert via bgg_id lookup
            }

            const { data: newGame, error } = await supabaseAdmin
              .from("games")
              .insert(insertData)
              .select("id")
              .single();

            if (error) {
              result.errors.push(`Add ${item.name}: ${error.message}`);
            } else {
              result.added++;
              if (ownershipStatus === "previously_owned") {
                result.previously_owned_added = (result.previously_owned_added || 0) + 1;
              }
              if (isComingSoon) result.wishlist_added = (result.wishlist_added || 0) + 1;

              // Create trade listing for for-trade games
              if (action === "for_trade" && newGame) {
                try {
                  const { error: tradeErr } = await supabaseAdmin
                    .from("trade_listings")
                    .insert({
                      user_id: userId,
                      game_id: newGame.id,
                      library_id,
                      condition: "Good",
                      notes: "Imported from BGG for-trade list",
                    });
                  if (!tradeErr) {
                    result.trade_listed = (result.trade_listed || 0) + 1;
                  }
                } catch (_e) {
                  console.warn(`[BGGSync] Could not create trade listing for "${item.name}"`);
                }
              }
            }
          }
        }

        // Handle games no longer in BGG collection
        for (const g of existingGames || []) {
          if (g.bgg_id && !bggIdsSeen.has(g.bgg_id)) {
            if (removalBehavior === "remove") {
              const { error } = await supabaseAdmin
                .from("games")
                .delete()
                .eq("id", g.id);
              if (error) {
                result.errors.push(`Remove ${g.title}: ${error.message}`);
              } else {
                result.removed++;
              }
            } else {
              result.flagged++;
            }
          }
        }
      } catch (err) {
        const errMsg = (err as Error).message;
        result.errors.push(`Collection fetch failed: ${errMsg}`);
        console.error(`[BGGSync] Collection error:`, errMsg);
      }
    }

    // ======================================================================
    // 2. Play history sync (delegate to existing bgg-play-import logic)
    // ======================================================================
    if (syncPlays) {
      try {
        const base = Deno.env.get("SUPABASE_URL")!;
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

        const playRes = await fetch(`${base}/functions/v1/bgg-play-import`, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            apikey: anonKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bgg_username: bggUsername,
            library_id,
            update_existing: false,
          }),
        });

        const playData = await playRes.json().catch(() => ({}));
        if (playData.success) {
          result.plays_imported = playData.imported || 0;
          console.log(`[BGGSync] Plays imported: ${result.plays_imported}`);
        } else {
          result.errors.push(`Play sync: ${playData.error || "unknown error"}`);
        }
      } catch (err) {
        result.errors.push(`Play sync failed: ${(err as Error).message}`);
      }
    }

    // ======================================================================
    // 3. Update sync status
    // ======================================================================
    const hasErrors = result.errors.length > 0;
    const statusMsg = [
      result.added > 0 ? `${result.added} added` : null,
      result.updated > 0 ? `${result.updated} updated` : null,
      result.removed > 0 ? `${result.removed} removed` : null,
      result.flagged > 0 ? `${result.flagged} no longer on BGG` : null,
      result.skipped > 0 ? `${result.skipped} unchanged` : null,
      result.plays_imported ? `${result.plays_imported} plays imported` : null,
      result.wishlist_added ? `${result.wishlist_added} wishlist/preorder items` : null,
      result.trade_listed ? `${result.trade_listed} listed for trade` : null,
      result.previously_owned_added ? `${result.previously_owned_added} previously owned` : null,
      hasErrors ? `${result.errors.length} errors` : null,
    ]
      .filter(Boolean)
      .join(", ");

    await supabaseAdmin
      .from("library_settings")
      .update({
        bgg_last_synced_at: new Date().toISOString(),
        bgg_last_sync_status: hasErrors ? "partial" : "success",
        bgg_last_sync_message: statusMsg || "No changes",
      })
      .eq("library_id", library_id);

    console.log(`[BGGSync] Complete: ${statusMsg}`);

    return new Response(
      JSON.stringify({
        success: true,
        result,
        message: statusMsg,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[BGGSync] Fatal error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message || "Sync failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
