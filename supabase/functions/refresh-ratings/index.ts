import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Fetches the BGG community average rating for a game via the XML API.
 * Returns the raw BGG 10-point scale rating (stored on game_catalog.bgg_community_rating).
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
    return bggRating;
  } catch {
    return null;
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const limit = body.limit || 30;

    // Refresh BGG community ratings on the catalog (not library games)
    // Find catalog entries with a bgg_id that either have no rating or need updating
    const { data: catalogEntries, error: catalogError } = await supabaseAdmin
      .from("game_catalog")
      .select("id, title, bgg_id, bgg_community_rating")
      .not("bgg_id", "is", null)
      .is("bgg_community_rating", null)
      .limit(limit);

    if (catalogError) {
      return new Response(
        JSON.stringify({ error: catalogError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!catalogEntries || catalogEntries.length === 0) {
      return new Response(
        JSON.stringify({ updated: 0, processed: 0, remaining: 0, message: "All catalog entries already have BGG ratings" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${catalogEntries.length} catalog entries for BGG rating refresh`);

    let updated = 0;
    let failed = 0;

    for (const entry of catalogEntries) {
      if (!entry.bgg_id) continue;

      const rating = await fetchBggRating(entry.bgg_id);
      if (rating !== null) {
        const { error: updateError } = await supabaseAdmin
          .from("game_catalog")
          .update({ bgg_community_rating: rating })
          .eq("id", entry.id);

        if (updateError) {
          console.error(`Failed to update catalog rating for ${entry.title}:`, updateError);
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

    // Count remaining catalog entries without rating
    const { count: remaining } = await supabaseAdmin
      .from("game_catalog")
      .select("id", { count: "exact", head: true })
      .not("bgg_id", "is", null)
      .is("bgg_community_rating", null);

    return new Response(
      JSON.stringify({ updated, failed, processed: catalogEntries.length, remaining: remaining || 0 }),
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

// Self-hosted: export default for main router; guard prevents standalone server conflict
if (import.meta.main) {
  Deno.serve(handler);
}
