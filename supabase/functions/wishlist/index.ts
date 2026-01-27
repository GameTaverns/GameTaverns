import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WishlistRequest {
  action: "add" | "remove" | "list";
  game_id?: string;
  guest_name?: string;
  guest_identifier: string;
}

// Export handler for self-hosted router
export default async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: WishlistRequest = await req.json();
    const { action, game_id, guest_name, guest_identifier } = body;

    // Validate guest_identifier
    if (!guest_identifier || guest_identifier.length < 8 || guest_identifier.length > 64) {
      return new Response(
        JSON.stringify({ error: "Invalid guest identifier" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate guest_name if provided (max 50 chars, no HTML)
    const sanitizedName = guest_name 
      ? guest_name.trim().slice(0, 50).replace(/<[^>]*>/g, '')
      : null;

    if (action === "add") {
      if (!game_id || !/^[0-9a-f-]{36}$/i.test(game_id)) {
        return new Response(
          JSON.stringify({ error: "Invalid game ID" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Upsert to handle duplicate votes gracefully
      const { error } = await supabase
        .from("game_wishlist")
        .upsert(
          {
            game_id,
            guest_name: sanitizedName,
            guest_identifier,
          },
          { onConflict: "game_id,guest_identifier" }
        );

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: "Vote added" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "remove") {
      if (!game_id || !/^[0-9a-f-]{36}$/i.test(game_id)) {
        return new Response(
          JSON.stringify({ error: "Invalid game ID" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("game_wishlist")
        .delete()
        .eq("game_id", game_id)
        .eq("guest_identifier", guest_identifier);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: "Vote removed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list") {
      // Get all votes for this guest
      const { data, error } = await supabase
        .from("game_wishlist")
        .select("game_id")
        .eq("guest_identifier", guest_identifier);

      if (error) throw error;

      return new Response(
        JSON.stringify({ votes: data?.map(v => v.game_id) || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Wishlist error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// For Lovable Cloud deployment (direct function invocation)
Deno.serve(handler);
