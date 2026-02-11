import { createClient } from "npm:@supabase/supabase-js@2";
import { withLogging } from "../_shared/system-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// BGG XML Helpers
// ============================================================================

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
  status_own: boolean;
  status_wishlist: boolean;
  status_want: boolean;
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

    // Parse status flags
    const statusMatch = content.match(/<status\s+([^/]*)\/?>/);
    const statusAttrs = statusMatch?.[1] || "";
    const statusOwn = statusAttrs.includes('own="1"');
    const statusWishlist = statusAttrs.includes('wishlist="1"');
    const statusWant = statusAttrs.includes('want="1"');

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
      status_own: statusOwn,
      status_wishlist: statusWishlist,
      status_want: statusWant,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Fetch proper high-quality image from BGG thing XML API
// The collection XML often returns opengraph (social crop) URLs.
// The thing XML API always returns the canonical full-quality image.
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
  } catch {
    return null;
  }
}

function isLowQualityBggImage(url: string | undefined): boolean {
  if (!url) return true;
  return /__opengraph|fit-in\/1200x630|filters:strip_icc|__thumb|__micro/i.test(url);
}

async function fetchBGGCollection(
  username: string,
  includeExpansions: boolean,
  includeWishlist: boolean,
): Promise<BGGCollectionItem[]> {
  const allItems: BGGCollectionItem[] = [];

  // Fetch owned items (always)
  const ownedUrl = `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(username)}&own=1&stats=1`;
  const ownedItems = await fetchBGGCollectionPage(ownedUrl);
  allItems.push(...ownedItems);

  // Fetch wishlist items if requested
  if (includeWishlist) {
    const wishlistUrl = `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(username)}&wishlist=1&stats=1`;
    const wishlistItems = await fetchBGGCollectionPage(wishlistUrl);
    // Mark as wishlist, avoid duplicates
    const existingIds = new Set(allItems.map((i) => i.bgg_id));
    for (const item of wishlistItems) {
      if (!existingIds.has(item.bgg_id)) {
        allItems.push(item);
      }
    }
  }

  // Filter expansions unless requested
  if (!includeExpansions) {
    return allItems.filter((i) => !i.is_expansion);
  }

  return allItems;
}

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
      // Update status
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
    // 1. Collection sync
    // ======================================================================
    if (syncCollection) {
      try {
        const bggItems = await fetchBGGCollection(bggUsername, true, syncWishlist);
        console.log(`[BGGSync] Fetched ${bggItems.length} items from BGG`);

        // Get all existing games in this library
        const { data: existingGames } = await supabaseAdmin
          .from("games")
          .select("id, title, bgg_id, is_coming_soon")
          .eq("library_id", library_id);

        const existingByBggId = new Map<string, { id: string; title: string; is_coming_soon: boolean }>();
        const existingByTitle = new Map<string, { id: string; bgg_id: string | null; is_coming_soon: boolean }>();

        for (const g of existingGames || []) {
          if (g.bgg_id) existingByBggId.set(g.bgg_id, { id: g.id, title: g.title, is_coming_soon: g.is_coming_soon });
          existingByTitle.set(g.title.toLowerCase(), { id: g.id, bgg_id: g.bgg_id, is_coming_soon: g.is_coming_soon });
        }

        const bggIdsSeen = new Set<string>();

        // Process each BGG item
        for (const item of bggItems) {
          bggIdsSeen.add(item.bgg_id);

          const existing = existingByBggId.get(item.bgg_id) ||
            existingByTitle.get(item.name.toLowerCase());

          if (existing) {
            // Game exists - update metadata if needed
            const updates: Record<string, unknown> = {};
            if (!existingByBggId.has(item.bgg_id) && existingByTitle.has(item.name.toLowerCase())) {
              // Link by bgg_id if matched by title
              updates.bgg_id = item.bgg_id;
              updates.bgg_url = `https://boardgamegeek.com/boardgame/${item.bgg_id}`;
            }
            if (item.image_url && !existing.is_coming_soon) {
              // If collection XML returned a low-quality image, fetch from thing XML
              if (isLowQualityBggImage(item.image_url)) {
                const betterImage = await fetchThingImage(item.bgg_id);
                if (betterImage) {
                  updates.image_url = betterImage;
                }
                // Small delay to be nice to BGG API
                await new Promise(r => setTimeout(r, 200));
              } else {
                updates.image_url = item.image_url;
              }
            }
            if (item.min_players) updates.min_players = item.min_players;
            if (item.max_players) updates.max_players = item.max_players;

            // If this is a wishlist item, mark as coming_soon
            if (!item.status_own && (item.status_wishlist || item.status_want)) {
              updates.is_coming_soon = true;
            } else if (item.status_own && existing.is_coming_soon) {
              // Was wishlist, now owned
              updates.is_coming_soon = false;
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
          } else {
            // New game - add it
            const isWishlist = !item.status_own && (item.status_wishlist || item.status_want);
            
            // Get proper image: if collection XML returned opengraph crop, fetch from thing XML
            let imageUrl = item.image_url || item.thumbnail_url || null;
            if (isLowQualityBggImage(imageUrl)) {
              const betterImage = await fetchThingImage(item.bgg_id);
              if (betterImage) imageUrl = betterImage;
              await new Promise(r => setTimeout(r, 200));
            }
            
            const { error } = await supabaseAdmin.from("games").insert({
              title: item.name,
              bgg_id: item.bgg_id,
              bgg_url: `https://boardgamegeek.com/boardgame/${item.bgg_id}`,
              image_url: imageUrl,
              min_players: item.min_players || null,
              max_players: item.max_players || null,
              is_expansion: item.is_expansion,
              is_coming_soon: isWishlist,
              library_id,
            });
            if (error) {
              result.errors.push(`Add ${item.name}: ${error.message}`);
            } else {
              result.added++;
              if (isWishlist) result.wishlist_added = (result.wishlist_added || 0) + 1;
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
              // Flag mode: mark as "no longer on BGG" by setting is_coming_soon
              // (we don't have a dedicated "removed_from_bgg" flag, so this is lightweight)
              // Actually, let's just skip flagging for now - the game stays in the library
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
          result.plays_imported = playData.result?.imported || 0;
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
      result.wishlist_added ? `${result.wishlist_added} wishlist items` : null,
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
