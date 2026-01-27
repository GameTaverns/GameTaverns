// Main router stub for Lovable Cloud
// In Cloud, each function is deployed independently and called directly via /functions/v1/{function-name}
// For self-hosted deployments, Kong routes directly to individual functions via the edge-runtime

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AVAILABLE_FUNCTIONS = [
  "bgg-import",
  "bgg-lookup",
  "bulk-import",
  "condense-descriptions",
  "decrypt-messages",
  "game-import",
  "image-proxy",
  "manage-users",
  "rate-game",
  "send-email",
  "send-message",
  "wishlist",
];

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
