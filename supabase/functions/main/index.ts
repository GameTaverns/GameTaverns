// Main router stub for Lovable Cloud
// In Cloud, each function is deployed independently and called directly via /functions/v1/{function-name}
// For self-hosted deployments, Kong routes directly to individual functions via the edge-runtime

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AVAILABLE_FUNCTIONS = [
  "bgg-import",
  "bgg-lookup",
  "bulk-import",
  "condense-descriptions",
  "decrypt-messages",
  "discord-config",
  "discord-create-event",
  "discord-delete-thread",
  "discord-forum-post",
  "discord-notify",
  "discord-oauth-callback",
  "discord-send-dm",
  "discord-unlink",
  "game-import",
  "game-recommendations",
  "image-proxy",
  "manage-account",
  "manage-users",
  "rate-game",
  "refresh-images",
  "resolve-username",
  "send-auth-email",
  "send-email",
  "send-message",
  "signup",
  "sync-achievements",
  "verify-email",
  "verify-reset-token",
  "wishlist",
];

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // In Lovable Cloud, this stub shouldn't receive traffic - functions are called directly
  // For self-hosted, Kong routes to individual function endpoints
  return new Response(
    JSON.stringify({
      message: "Edge function router",
      note: "Call functions directly at /functions/v1/{function-name}",
      available: AVAILABLE_FUNCTIONS,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

Deno.serve(handler);
