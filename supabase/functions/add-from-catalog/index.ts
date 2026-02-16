import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map catalog weight to difficulty enum
function weightToDifficulty(weight: number | null): string {
  if (weight == null) return "3 - Medium";
  if (weight <= 1.5) return "1 - Light";
  if (weight <= 2.25) return "2 - Medium Light";
  if (weight <= 3.0) return "3 - Medium";
  if (weight <= 3.75) return "4 - Medium Heavy";
  return "5 - Heavy";
}

// Map play_time_minutes to play_time enum
function minutesToPlayTime(minutes: number | null): string {
  if (minutes == null) return "45-60 Minutes";
  if (minutes <= 15) return "0-15 Minutes";
  if (minutes <= 30) return "15-30 Minutes";
  if (minutes <= 45) return "30-45 Minutes";
  if (minutes <= 60) return "45-60 Minutes";
  if (minutes <= 120) return "60+ Minutes";
  if (minutes <= 180) return "2+ Hours";
  return "3+ Hours";
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
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
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user's library
    const { data: libraryRows } = await supabaseAdmin
      .from("libraries")
      .select("id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);

    const libraryId = libraryRows?.[0]?.id;
    if (!libraryId) {
      return new Response(JSON.stringify({ error: "You must own a library to add games" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { catalog_id, library_id } = await req.json();
    const targetLibraryId = library_id || libraryId;

    if (!catalog_id) {
      return new Response(JSON.stringify({ error: "catalog_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership of target library
    const { data: targetLib } = await supabaseAdmin
      .from("libraries")
      .select("id, owner_id")
      .eq("id", targetLibraryId)
      .maybeSingle();

    if (!targetLib || targetLib.owner_id !== userId) {
      return new Response(JSON.stringify({ error: "You don't own this library" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch catalog entry
    const { data: catalog, error: catalogError } = await supabaseAdmin
      .from("game_catalog")
      .select("*")
      .eq("id", catalog_id)
      .maybeSingle();

    if (catalogError || !catalog) {
      return new Response(JSON.stringify({ error: "Catalog entry not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if game already exists in this library by catalog_id
    const { data: existing } = await supabaseAdmin
      .from("games")
      .select("id, title")
      .eq("library_id", targetLibraryId)
      .eq("catalog_id", catalog_id)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({
        success: true,
        action: "already_exists",
        game: { id: existing.id, title: existing.title },
        message: `"${existing.title}" is already in your library.`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also check by bgg_id if available
    if (catalog.bgg_id) {
      const { data: byBgg } = await supabaseAdmin
        .from("games")
        .select("id, title")
        .eq("library_id", targetLibraryId)
        .eq("bgg_id", catalog.bgg_id)
        .maybeSingle();

      if (byBgg) {
        // Link catalog_id to existing game
        await supabaseAdmin.from("games").update({ catalog_id }).eq("id", byBgg.id);
        return new Response(JSON.stringify({
          success: true,
          action: "already_exists",
          game: { id: byBgg.id, title: byBgg.title },
          message: `"${byBgg.title}" is already in your library.`,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch related metadata from catalog
    const [publishersRes, mechanicsRes, designersRes, artistsRes] = await Promise.all([
      supabaseAdmin.from("catalog_publishers").select("publisher:publishers(id, name)").eq("catalog_id", catalog_id),
      supabaseAdmin.from("catalog_mechanics").select("mechanic:mechanics(id, name)").eq("catalog_id", catalog_id),
      supabaseAdmin.from("catalog_designers").select("designer:designers(id, name)").eq("catalog_id", catalog_id),
      supabaseAdmin.from("catalog_artists").select("artist:artists(id, name)").eq("catalog_id", catalog_id),
    ]);

    const publishers = (publishersRes.data || []).map((r: any) => r.publisher).filter(Boolean);
    const mechanics = (mechanicsRes.data || []).map((r: any) => r.mechanic).filter(Boolean);
    const designers = (designersRes.data || []).map((r: any) => r.designer).filter(Boolean);
    const artists = (artistsRes.data || []).map((r: any) => r.artist).filter(Boolean);

    // Detect parent game if expansion
    let parentGameId: string | null = null;
    if (catalog.is_expansion && catalog.parent_catalog_id) {
      const { data: parentGame } = await supabaseAdmin
        .from("games")
        .select("id")
        .eq("library_id", targetLibraryId)
        .eq("catalog_id", catalog.parent_catalog_id)
        .maybeSingle();
      parentGameId = parentGame?.id || null;
    }

    // Build game record
    const gameData = {
      title: catalog.title,
      description: catalog.description || `${catalog.title} - added from the GameTaverns catalog.`,
      image_url: catalog.image_url,
      additional_images: catalog.additional_images || [],
      difficulty: weightToDifficulty(catalog.weight),
      game_type: "Board Game" as const,
      play_time: minutesToPlayTime(catalog.play_time_minutes),
      min_players: catalog.min_players || 1,
      max_players: catalog.max_players || 4,
      suggested_age: catalog.suggested_age || "10+",
      publisher_id: publishers[0]?.id || null,
      bgg_id: catalog.bgg_id,
      bgg_url: catalog.bgg_url,
      is_expansion: catalog.is_expansion,
      parent_game_id: parentGameId,
      catalog_id: catalog.id,
      library_id: targetLibraryId,
      slug: catalog.slug,
    };

    const { data: game, error: gameError } = await supabaseAdmin
      .from("games")
      .insert(gameData)
      .select("id, title")
      .single();

    if (gameError) {
      console.error("[AddFromCatalog] Insert error:", gameError);
      throw gameError;
    }

    // Link mechanics
    if (mechanics.length > 0) {
      await supabaseAdmin.from("game_mechanics").insert(
        mechanics.map((m: any) => ({ game_id: game.id, mechanic_id: m.id }))
      );
    }

    // Link designers
    if (designers.length > 0) {
      await supabaseAdmin.from("game_designers").insert(
        designers.map((d: any) => ({ game_id: game.id, designer_id: d.id }))
      );
    }

    // Link artists
    if (artists.length > 0) {
      await supabaseAdmin.from("game_artists").insert(
        artists.map((a: any) => ({ game_id: game.id, artist_id: a.id }))
      );
    }

    console.log(`[AddFromCatalog] Added "${game.title}" to library ${targetLibraryId}`);

    return new Response(JSON.stringify({
      success: true,
      action: "added",
      game: { id: game.id, title: game.title },
      message: `"${game.title}" has been added to your library!`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[AddFromCatalog] Error:", error);
    return new Response(JSON.stringify({ error: "Failed to add game. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
