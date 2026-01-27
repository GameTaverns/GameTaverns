import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-fingerprint",
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MINUTES = 60;
const MAX_RATINGS_PER_WINDOW = 10;

interface RateGameRequest {
  gameId: string;
  rating: number;
  guestIdentifier: string;
  deviceFingerprint?: string;
}

// Extract client IP from request headers
function getClientIP(req: Request): string {
  // Check common proxy headers
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  
  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }
  
  const cfConnectingIP = req.headers.get("cf-connecting-ip");
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  return "unknown";
}

// Hash IP address for privacy (one-way)
async function hashValue(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Export handler for self-hosted router
export default async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Get client IP
    const clientIP = getClientIP(req);
    const hashedIP = await hashValue(clientIP);

    // GET: Fetch user's own ratings by guestIdentifier
    if (req.method === "GET") {
      const url = new URL(req.url);
      const guestIdentifier = url.searchParams.get("guestIdentifier");
      
      if (!guestIdentifier) {
        return new Response(
          JSON.stringify({ error: "Missing guestIdentifier" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Only return game_id and rating - never expose IP/fingerprint
      const { data, error } = await supabase
        .from("game_ratings")
        .select("game_id, rating")
        .eq("guest_identifier", guestIdentifier);
      
      if (error) {
        console.error("Error fetching user ratings:", error);
        return new Response(
          JSON.stringify({ error: "Failed to fetch ratings" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ ratings: data || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "POST") {
      const body: RateGameRequest = await req.json();
      const { gameId, rating, guestIdentifier, deviceFingerprint } = body;
      
      // Get device fingerprint from header or body
      const fingerprint = req.headers.get("x-device-fingerprint") || deviceFingerprint || "";

      // Validate inputs
      if (!gameId || typeof gameId !== "string") {
        return new Response(
          JSON.stringify({ error: "Invalid game ID" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
        return new Response(
          JSON.stringify({ error: "Rating must be between 1 and 5" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!guestIdentifier || typeof guestIdentifier !== "string") {
        return new Response(
          JSON.stringify({ error: "Invalid guest identifier" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Rate limiting check - count ratings from this IP in the last hour
      const rateLimitWindow = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
      
      const { count: recentRatingsCount, error: rateLimitError } = await supabase
        .from("game_ratings")
        .select("*", { count: "exact", head: true })
        .eq("ip_address", hashedIP)
        .gte("created_at", rateLimitWindow);

      if (rateLimitError) {
        console.error("Rate limit check error:", rateLimitError);
      }

      if (recentRatingsCount !== null && recentRatingsCount >= MAX_RATINGS_PER_WINDOW) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if this IP + fingerprint combo already rated this game
      if (fingerprint) {
        const { data: existingRating } = await supabase
          .from("game_ratings")
          .select("id, guest_identifier")
          .eq("game_id", gameId)
          .eq("ip_address", hashedIP)
          .eq("device_fingerprint", fingerprint)
          .maybeSingle();

        // If found with different guest_identifier, they're trying to double-vote
        if (existingRating && existingRating.guest_identifier !== guestIdentifier) {
          return new Response(
            JSON.stringify({ error: "You have already rated this game." }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Verify the game exists
      const { data: game, error: gameError } = await supabase
        .from("games_public")
        .select("id")
        .eq("id", gameId)
        .single();

      if (gameError || !game) {
        return new Response(
          JSON.stringify({ error: "Game not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Upsert the rating (update if exists, insert if new)
      const { data, error } = await supabase
        .from("game_ratings")
        .upsert(
          {
            game_id: gameId,
            rating: Math.round(rating),
            guest_identifier: guestIdentifier,
            ip_address: hashedIP,
            device_fingerprint: fingerprint || null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "game_id,guest_identifier",
          }
        )
        .select()
        .single();

      if (error) {
        console.error("Error upserting rating:", error);
        return new Response(
          JSON.stringify({ error: "Failed to save rating" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, rating: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "DELETE") {
      const { gameId, guestIdentifier }: { gameId: string; guestIdentifier: string } = await req.json();

      if (!gameId || !guestIdentifier) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("game_ratings")
        .delete()
        .eq("game_id", gameId)
        .eq("guest_identifier", guestIdentifier);

      if (error) {
        console.error("Error deleting rating:", error);
        return new Response(
          JSON.stringify({ error: "Failed to delete rating" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// For Lovable Cloud deployment (direct function invocation)
Deno.serve(handler);
