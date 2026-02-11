import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Fetches the BGG community average rating for a game via the XML API.
 * Maps BGG's 10-point scale to our 5-star scale: Math.round(bggRating / 2), clamped 1–5.
 */
async function fetchBggRating(bggId: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://boardgamegeek.com/xmlapi2/thing?id=${bggId}&stats=1`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/xml",
        },
      }
    );
    if (!res.ok) return null;
    const xml = await res.text();
    const match = xml.match(/<average\s+value="([^"]+)"/);
    if (!match) return null;
    const bggRating = parseFloat(match[1]);
    if (isNaN(bggRating) || bggRating <= 0) return null;
    return Math.max(1, Math.min(5, Math.round(bggRating / 2)));
  } catch {
    return null;
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
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
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify library ownership
    const { data: library } = await supabaseAdmin
      .from("libraries")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();

    if (!library) {
      return new Response(
        JSON.stringify({ error: "You must own a library to refresh ratings" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const libraryId = body.library_id || library.id;
    const limit = body.limit || 30;

    // Find games with bgg_id that don't yet have a bgg-community rating
    // Use a left join approach: get games with bgg_id, then check ratings
    const { data: games, error: gamesError } = await supabaseAdmin
      .from("games")
      .select("id, title, bgg_id")
      .eq("library_id", libraryId)
      .not("bgg_id", "is", null)
      .limit(limit);

    if (gamesError) {
      return new Response(
        JSON.stringify({ error: gamesError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!games || games.length === 0) {
      return new Response(
        JSON.stringify({ updated: 0, processed: 0, remaining: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check which games already have bgg-community ratings
    const gameIds = games.map(g => g.id);
    const { data: existingRatings } = await supabaseAdmin
      .from("game_ratings")
      .select("game_id")
      .eq("guest_identifier", "bgg-community")
      .in("game_id", gameIds);

    const hasRating = new Set((existingRatings || []).map(r => r.game_id));
    const needsRating = games.filter(g => !hasRating.has(g.id));

    if (needsRating.length === 0) {
      return new Response(
        JSON.stringify({ updated: 0, processed: games.length, remaining: 0, message: "All games already have BGG ratings" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${needsRating.length} games for BGG rating refresh`);

    let updated = 0;
    let failed = 0;

    for (const game of needsRating) {
      if (!game.bgg_id) continue;

      const rating = await fetchBggRating(game.bgg_id);
      if (rating !== null) {
        const { error: upsertError } = await supabaseAdmin
          .from("game_ratings")
          .upsert(
            {
              game_id: game.id,
              guest_identifier: "bgg-community",
              rating,
            },
            { onConflict: "game_id,guest_identifier" }
          );

        if (upsertError) {
          console.error(`Failed to upsert rating for ${game.title}:`, upsertError);
          failed++;
        } else {
          updated++;
        }
      } else {
        failed++;
      }

      // Rate-limit BGG API calls
      await new Promise(r => setTimeout(r, 250));
    }

    // Count remaining games without bgg-community rating
    const { data: allBggGames } = await supabaseAdmin
      .from("games")
      .select("id")
      .eq("library_id", libraryId)
      .not("bgg_id", "is", null);

    const allIds = (allBggGames || []).map(g => g.id);
    const { data: allRatings } = await supabaseAdmin
      .from("game_ratings")
      .select("game_id")
      .eq("guest_identifier", "bgg-community")
      .in("game_id", allIds.slice(0, 1000));

    const ratedSet = new Set((allRatings || []).map(r => r.game_id));
    const remaining = allIds.filter(id => !ratedSet.has(id)).length;

    return new Response(
      JSON.stringify({ updated, failed, processed: needsRating.length, remaining }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Refresh ratings error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Failed to refresh ratings" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

Deno.serve(handler);
