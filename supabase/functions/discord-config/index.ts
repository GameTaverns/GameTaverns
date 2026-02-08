const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Returns public Discord OAuth configuration.
 * Client ID is safe to expose (it's public).
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get("DISCORD_CLIENT_ID");
    // Use APP_URL for self-hosted or SUPABASE_URL for cloud
    const appUrl = Deno.env.get("APP_URL");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    
    // For self-hosted: use APP_URL/functions/v1/...
    // For cloud: use SUPABASE_URL/functions/v1/...
    const baseUrl = appUrl || supabaseUrl;

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "Discord integration not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!baseUrl) {
      return new Response(
        JSON.stringify({ error: "Server URL not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        client_id: clientId,
        redirect_uri: `${baseUrl}/functions/v1/discord-oauth-callback`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Discord config error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
