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

function parseBggXml(xml: string) {
  const mechanicsMatches = xml.matchAll(/<link[^>]*type="boardgamemechanic"[^>]*value="([^"]+)"/g);
  const mechanics = [...mechanicsMatches].map((m) => decodeHtmlEntities(m[1]));
  const publisherMatch = xml.match(/<link[^>]*type="boardgamepublisher"[^>]*value="([^"]+)"/);
  const designerMatches = xml.matchAll(/<link[^>]*type="boardgamedesigner"[^>]*value="([^"]+)"/g);
  const designers = [...designerMatches].map((m) => decodeHtmlEntities(m[1]));
  const artistMatches = xml.matchAll(/<link[^>]*type="boardgameartist"[^>]*value="([^"]+)"/g);
  const artists = [...artistMatches].map((m) => decodeHtmlEntities(m[1]));
  const descMatch = xml.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
  const description = descMatch?.[1] ? decodeHtmlEntities(descMatch[1]).trim().slice(0, 5000) : undefined;

  return {
    mechanics,
    publisher: publisherMatch?.[1] ? decodeHtmlEntities(publisherMatch[1]) : undefined,
    designers,
    artists,
    description,
  };
}

async function upsertDesignersByName(admin: ReturnType<typeof createClient>, names: string[]) {
  const ids: string[] = [];
  for (const name of names) {
    const { data: existing } = await admin.from("designers").select("id").eq("name", name).maybeSingle();
    if (existing?.id) { ids.push(existing.id); continue; }
    const { data: inserted } = await admin.from("designers").upsert({ name }, { onConflict: "name" }).select("id").single();
    if (inserted?.id) ids.push(inserted.id);
  }
  return ids;
}

async function upsertArtistsByName(admin: ReturnType<typeof createClient>, names: string[]) {
  const ids: string[] = [];
  for (const name of names) {
    const { data: existing } = await admin.from("artists").select("id").eq("name", name).maybeSingle();
    if (existing?.id) { ids.push(existing.id); continue; }
    const { data: inserted } = await admin.from("artists").upsert({ name }, { onConflict: "name" }).select("id").single();
    if (inserted?.id) ids.push(inserted.id);
  }
  return ids;
}

/**
 * Catalog Backfill — populates game_catalog with designers, artists,
 * and enriched descriptions from existing games with bgg_id.
 *
 * Modes:
 * - default: Link unlinked games to catalog entries
 * - enrich: Re-fetch BGG XML to add designers/artists (processes batch_size entries per call)
 *
 * Params: { mode, batch_size (default 5), offset (default 0) }
 */
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Auth required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: roleData } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "default";
    const batchSize = Math.min(body.batch_size || 5, 10); // Cap at 10 for timeout safety
    const offset = body.offset || 0;

    // =====================================================================
    // MODE: enrich — Re-fetch BGG XML for catalog entries to add designers/artists
    // =====================================================================
    if (mode === "enrich") {
      // Find catalog entries that are MISSING designers or artists
      const { data: catalogEntries, error: catErr } = await admin
        .from("game_catalog")
        .select("id, bgg_id, title")
        .not("bgg_id", "is", null)
        .order("title")
        .range(offset, offset + batchSize - 1);

      if (catErr) {
        return new Response(JSON.stringify({ error: catErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!catalogEntries || catalogEntries.length === 0) {
        return new Response(JSON.stringify({
          success: true, processed: 0, designersAdded: 0, artistsAdded: 0,
          message: "No more catalog entries to process", hasMore: false,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let processed = 0;
      let designersAdded = 0;
      let artistsAdded = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const entry of catalogEntries) {
        try {
          // Check if already has both designers and artists
          const { count: dCount } = await admin
            .from("catalog_designers").select("id", { count: "exact", head: true }).eq("catalog_id", entry.id);
          const { count: aCount } = await admin
            .from("catalog_artists").select("id", { count: "exact", head: true }).eq("catalog_id", entry.id);

          if ((dCount || 0) > 0 && (aCount || 0) > 0) {
            skipped++;
            continue;
          }

          // Fetch BGG XML with retry
          const xmlUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${entry.bgg_id}&stats=1`;
          let res: Response | null = null;
          let fetchAttempts = 0;
          const maxAttempts = 3;

          while (fetchAttempts < maxAttempts) {
            fetchAttempts++;
            try {
              res = await fetch(xmlUrl, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (compatible; GameTaverns/1.0)",
                  Accept: "application/xml",
                },
              });

              if (res.status === 429) {
                const waitMs = fetchAttempts * 2000; // 2s, 4s, 6s
                errors.push(`${entry.title}: Rate limited (429), retry ${fetchAttempts}/${maxAttempts}, waiting ${waitMs}ms`);
                await sleep(waitMs);
                res = null;
                continue;
              }

              if (res.status === 202) {
                // BGG returns 202 when data is being prepared
                errors.push(`${entry.title}: BGG returned 202 (queued), retry ${fetchAttempts}/${maxAttempts}`);
                await sleep(3000);
                res = null;
                continue;
              }

              break; // Success or non-retryable error
            } catch (fetchErr) {
              errors.push(`${entry.title}: Fetch error attempt ${fetchAttempts}: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`);
              if (fetchAttempts < maxAttempts) await sleep(2000);
            }
          }

          if (!res) {
            errors.push(`${entry.title}: All ${maxAttempts} fetch attempts failed`);
            continue;
          }

          if (!res.ok) {
            errors.push(`${entry.title}: HTTP ${res.status}`);
            continue;
          }

          const xml = await res.text();
          if (!xml.includes("<item")) {
            errors.push(`${entry.title}: No item data in response (${xml.length} chars)`);
            continue;
          }

          const parsed = parseBggXml(xml);

          // Upsert designers
          const designerIds = await upsertDesignersByName(admin, parsed.designers);
          for (const designerId of designerIds) {
            await admin.from("catalog_designers").upsert(
              { catalog_id: entry.id, designer_id: designerId },
              { onConflict: "catalog_id,designer_id" }
            );
            designersAdded++;
          }

          // Upsert artists
          const artistIds = await upsertArtistsByName(admin, parsed.artists);
          for (const artistId of artistIds) {
            await admin.from("catalog_artists").upsert(
              { catalog_id: entry.id, artist_id: artistId },
              { onConflict: "catalog_id,artist_id" }
            );
            artistsAdded++;
          }

          // Also backfill game_designers/game_artists for linked games
          const { data: linkedGames } = await admin.from("games").select("id").eq("catalog_id", entry.id);
          if (linkedGames) {
            for (const game of linkedGames) {
              for (const dId of designerIds) {
                await admin.from("game_designers").upsert(
                  { game_id: game.id, designer_id: dId },
                  { onConflict: "game_id,designer_id" }
                );
              }
              for (const aId of artistIds) {
                await admin.from("game_artists").upsert(
                  { game_id: game.id, artist_id: aId },
                  { onConflict: "game_id,artist_id" }
                );
              }
            }
          }

          processed++;
          // Rate-limit pause between BGG requests
          await sleep(500);
        } catch (e) {
          errors.push(`${entry.title}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      const hasMore = catalogEntries.length === batchSize;

      return new Response(JSON.stringify({
        success: true, mode: "enrich", processed, skipped, designersAdded, artistsAdded,
        total: catalogEntries.length, offset, nextOffset: offset + batchSize,
        hasMore, errors: errors.slice(0, 20),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // =====================================================================
    // DEFAULT MODE: Link unlinked games to catalog
    // =====================================================================
    const { data: unlinkedGames, error: fetchErr } = await admin
      .from("games")
      .select("id, bgg_id, title, image_url, description, min_players, max_players, play_time, difficulty, is_expansion, bgg_url, suggested_age, publisher_id")
      .not("bgg_id", "is", null)
      .is("catalog_id", null)
      .limit(batchSize);

    if (fetchErr) throw fetchErr;
    if (!unlinkedGames || unlinkedGames.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, linked: 0, message: "All games already linked", hasMore: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const byBggId = new Map<string, typeof unlinkedGames>();
    for (const game of unlinkedGames) {
      if (!game.bgg_id) continue;
      const existing = byBggId.get(game.bgg_id) || [];
      existing.push(game);
      byBggId.set(game.bgg_id, existing);
    }

    let processed = 0;
    let linked = 0;
    const errors: string[] = [];

    const weightMap: Record<string, number> = {
      "1 - Light": 1.25, "2 - Medium Light": 1.88, "3 - Medium": 2.63,
      "4 - Medium Heavy": 3.38, "5 - Heavy": 4.25,
    };
    const timeMap: Record<string, number> = {
      "0-15 Minutes": 15, "15-30 Minutes": 30, "30-45 Minutes": 45,
      "45-60 Minutes": 60, "60+ Minutes": 90, "2+ Hours": 150, "3+ Hours": 210,
    };

    for (const [bggId, games] of byBggId) {
      const firstGame = games[0];
      try {
        const catalogData: Record<string, unknown> = {
          bgg_id: bggId,
          title: firstGame.title,
          image_url: firstGame.image_url || null,
          description: firstGame.description?.slice(0, 10000) || null,
          min_players: firstGame.min_players || null,
          max_players: firstGame.max_players || null,
          play_time_minutes: firstGame.play_time ? timeMap[firstGame.play_time] || null : null,
          weight: firstGame.difficulty ? weightMap[firstGame.difficulty] || null : null,
          suggested_age: firstGame.suggested_age || null,
          is_expansion: firstGame.is_expansion === true,
          bgg_url: firstGame.bgg_url || `https://boardgamegeek.com/boardgame/${bggId}`,
        };

        const { data: entry, error: upsertErr } = await admin
          .from("game_catalog")
          .upsert(catalogData, { onConflict: "bgg_id" })
          .select("id")
          .single();

        if (upsertErr) { errors.push(`${bggId}: ${upsertErr.message}`); continue; }

        if (entry?.id) {
          const gameIds = games.map(g => g.id);
          await admin.from("games").update({ catalog_id: entry.id }).in("id", gameIds);
          linked += gameIds.length;

          // Backfill catalog_mechanics
          const { data: mechs } = await admin.from("game_mechanics").select("mechanic_id").eq("game_id", firstGame.id);
          if (mechs) {
            for (const m of mechs) {
              await admin.from("catalog_mechanics").upsert({ catalog_id: entry.id, mechanic_id: m.mechanic_id }, { onConflict: "catalog_id,mechanic_id" });
            }
          }

          // Backfill catalog_publishers
          if (firstGame.publisher_id) {
            await admin.from("catalog_publishers").upsert({ catalog_id: entry.id, publisher_id: firstGame.publisher_id }, { onConflict: "catalog_id,publisher_id" });
          }

          // Backfill designers/artists from game tables
          const { data: gDesigners } = await admin.from("game_designers").select("designer_id").eq("game_id", firstGame.id);
          if (gDesigners) {
            for (const d of gDesigners) {
              await admin.from("catalog_designers").upsert({ catalog_id: entry.id, designer_id: d.designer_id }, { onConflict: "catalog_id,designer_id" });
            }
          }
          const { data: gArtists } = await admin.from("game_artists").select("artist_id").eq("game_id", firstGame.id);
          if (gArtists) {
            for (const a of gArtists) {
              await admin.from("catalog_artists").upsert({ catalog_id: entry.id, artist_id: a.artist_id }, { onConflict: "catalog_id,artist_id" });
            }
          }
        }

        processed++;
      } catch (e) {
        errors.push(`${bggId}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const hasMore = unlinkedGames.length === batchSize;

    return new Response(
      JSON.stringify({ success: true, unique_bgg_ids: byBggId.size, processed, linked, hasMore, errors: errors.slice(0, 10) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Backfill error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

export default handler;

if (import.meta.main) {
  Deno.serve(handler);
}
