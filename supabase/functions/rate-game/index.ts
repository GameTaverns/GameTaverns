import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-fingerprint",
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MINUTES = 60;
const MAX_RATINGS_PER_WINDOW = 50;

interface RateGameRequest {
  gameId: string;
  catalogId?: string; // If set, rate a catalog game instead
  rating: number;
  guestIdentifier: string;
  deviceFingerprint?: string;
}

// Extract client IP from request headers
function getClientIP(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIP = req.headers.get("x-real-ip");
  if (realIP) return realIP;
  const cfConnectingIP = req.headers.get("cf-connecting-ip");
  if (cfConnectingIP) return cfConnectingIP;
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const clientIP = getClientIP(req);
    const hashedIP = await hashValue(clientIP);

    // GET: Fetch user's own ratings by guestIdentifier
    if (req.method === "GET") {
      const url = new URL(req.url);
      const guestIdentifier =
        url.searchParams.get("guestIdentifier") ||
        req.headers.get("x-guest-identifier");
      const target = url.searchParams.get("target") || "library"; // "library" or "catalog"

      if (!guestIdentifier) {
        return new Response(
          JSON.stringify({ error: "Missing guestIdentifier" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (target === "catalog") {
        const { data, error } = await supabase
          .from("catalog_ratings")
          .select("catalog_id, rating")
          .eq("guest_identifier", guestIdentifier)
          .eq("source", "visitor");

        if (error) {
          console.error("Error fetching catalog ratings:", error);
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

      // Library ratings (default)
      const { data, error } = await supabase
        .from("game_ratings")
        .select("game_id, rating")
        .eq("guest_identifier", guestIdentifier)
        .eq("source", "visitor");

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
      const { gameId, catalogId, rating, guestIdentifier, deviceFingerprint } = body;
      const fingerprint = req.headers.get("x-device-fingerprint") || deviceFingerprint || "";
      const isCatalog = !!catalogId;
      const targetId = isCatalog ? catalogId : gameId;
      const idColumn = isCatalog ? "catalog_id" : "game_id";
      const tableName = isCatalog ? "catalog_ratings" : "game_ratings";

      // Validate inputs
      if (!targetId || typeof targetId !== "string") {
        return new Response(
          JSON.stringify({ error: "Invalid ID" }),
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

      // Rate limiting - check across both tables
      const rateLimitWindow = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
      const { count: recentRatingsCount } = await supabase
        .from(tableName)
        .select("*", { count: "exact", head: true })
        .eq("ip_address", hashedIP)
        .gte("created_at", rateLimitWindow);

      if (recentRatingsCount !== null && recentRatingsCount >= MAX_RATINGS_PER_WINDOW) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Anti-manipulation: check IP + fingerprint
      if (fingerprint) {
        const { data: existingRating } = await supabase
          .from(tableName)
          .select("id, guest_identifier")
          .eq(idColumn, targetId)
          .eq("ip_address", hashedIP)
          .eq("device_fingerprint", fingerprint)
          .maybeSingle();

        if (existingRating && existingRating.guest_identifier !== guestIdentifier) {
          return new Response(
            JSON.stringify({ error: "You have already rated this game." }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Verify the target exists
      if (isCatalog) {
        const { data: cat, error: catError } = await supabase
          .from("game_catalog")
          .select("id")
          .eq("id", targetId)
          .single();
        if (catError || !cat) {
          return new Response(
            JSON.stringify({ error: "Catalog game not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        const { data: game, error: gameError } = await supabase
          .from("games_public")
          .select("id")
          .eq("id", targetId)
          .single();
        if (gameError || !game) {
          return new Response(
            JSON.stringify({ error: "Game not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Upsert the rating
      const upsertData: Record<string, unknown> = {
        [idColumn]: targetId,
        rating: Math.round(rating),
        guest_identifier: guestIdentifier,
        source: "visitor",
        ip_address: hashedIP,
        device_fingerprint: fingerprint || null,
        updated_at: new Date().toISOString(),
      };

      const conflictKey = isCatalog ? "catalog_id,guest_identifier" : "game_id,guest_identifier";

      const { data, error } = await supabase
        .from(tableName)
        .upsert(upsertData, { onConflict: conflictKey })
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
      const body = await req.json();
      const { gameId, catalogId, guestIdentifier } = body;
      const isCatalog = !!catalogId;
      const targetId = isCatalog ? catalogId : gameId;
      const idColumn = isCatalog ? "catalog_id" : "game_id";
      const tableName = isCatalog ? "catalog_ratings" : "game_ratings";

      if (!targetId || !guestIdentifier) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq(idColumn, targetId)
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
if (import.meta.main) {
  Deno.serve(handler);
}
