import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Catalog Backfill — populates game_catalog from existing games with bgg_id.
 * Called once (or periodically) by admin to seed the canonical catalog
 * from games that were imported before the catalog existed.
 */
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Auth required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify admin
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await createClient(supabaseUrl, serviceKey)
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Find games with bgg_id but no catalog_id
    const { data: unlinkedGames, error: fetchErr } = await admin
      .from("games")
      .select("id, bgg_id, title, image_url, description, min_players, max_players, play_time, difficulty, is_expansion, bgg_url, suggested_age, publisher_id")
      .not("bgg_id", "is", null)
      .is("catalog_id", null)
      .limit(500);

    if (fetchErr) throw fetchErr;
    if (!unlinkedGames || unlinkedGames.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, message: "All games already linked" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by bgg_id to avoid duplicate upserts
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

    // Parse weight from difficulty enum
    const weightMap: Record<string, number> = {
      "1 - Light": 1.25,
      "2 - Medium Light": 1.88,
      "3 - Medium": 2.63,
      "4 - Medium Heavy": 3.38,
      "5 - Heavy": 4.25,
    };

    // Parse play_time_minutes from play_time enum
    const timeMap: Record<string, number> = {
      "0-15 Minutes": 15,
      "15-30 Minutes": 30,
      "30-45 Minutes": 45,
      "45-60 Minutes": 60,
      "60+ Minutes": 90,
      "2+ Hours": 150,
      "3+ Hours": 210,
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

        if (upsertErr) {
          errors.push(`${bggId}: ${upsertErr.message}`);
          continue;
        }

        // Link all games with this bgg_id to the catalog entry
        if (entry?.id) {
          const gameIds = games.map(g => g.id);
          await admin
            .from("games")
            .update({ catalog_id: entry.id })
            .in("id", gameIds);
          linked += gameIds.length;

          // Backfill catalog_mechanics from game_mechanics
          const { data: mechs } = await admin
            .from("game_mechanics")
            .select("mechanic_id")
            .eq("game_id", firstGame.id);

          if (mechs && mechs.length > 0) {
            for (const m of mechs) {
              await admin
                .from("catalog_mechanics")
                .upsert(
                  { catalog_id: entry.id, mechanic_id: m.mechanic_id },
                  { onConflict: "catalog_id,mechanic_id" }
                );
            }
          }

          // Backfill catalog_publishers
          if (firstGame.publisher_id) {
            await admin
              .from("catalog_publishers")
              .upsert(
                { catalog_id: entry.id, publisher_id: firstGame.publisher_id },
                { onConflict: "catalog_id,publisher_id" }
              );
          }
        }

        processed++;
      } catch (e) {
        errors.push(`${bggId}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        unique_bgg_ids: byBggId.size,
        processed,
        linked,
        errors: errors.slice(0, 10),
      }),
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
