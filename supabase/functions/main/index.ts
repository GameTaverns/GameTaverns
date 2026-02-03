// Main router for self-hosted deployments
// Routes incoming requests to the appropriate edge function
// For Lovable Cloud, each function is deployed independently

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// All available functions - update this list when adding new functions
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
  "totp-disable",
  "totp-setup",
  "totp-status",
  "totp-verify",
  "verify-email",
  "verify-reset-token",
  "wishlist",
];

async function routeToFunction(functionName: string, req: Request): Promise<Response> {
  // Dynamic import of the function module
  const modulePath = `../${functionName}/index.ts`;
  
  try {
    // deno-lint-ignore no-explicit-any
    const module = await import(modulePath) as any;
    
    // Try different export patterns used by functions
    if (typeof module.default === "function") {
      return await module.default(req);
    }
    
    // Some functions export a named handler
    if (typeof module.handler === "function") {
      return await module.handler(req);
    }
    
    // If module uses Deno.serve pattern, it registered itself already
    // In that case, we can't route to it - return error
    return new Response(
      JSON.stringify({ 
        error: "Function uses Deno.serve pattern - direct routing not possible",
        hint: "This router is for reference only. Functions should be accessed directly via edge-runtime autodiscovery."
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`Error importing function ${functionName}:`, error);
    return new Response(
      JSON.stringify({
        error: "Failed to load function",
        function: functionName,
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Extract function name from URL path
  // URL format: http://functions:9000/{function-name} (after Kong strips /functions/v1/)
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const functionName = pathParts[0];

  // If no function specified or requesting root/main, return available functions list
  if (!functionName || functionName === "main") {
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

  // Check if function exists in our list
  if (!AVAILABLE_FUNCTIONS.includes(functionName)) {
    return new Response(
      JSON.stringify({
        error: "Function not found",
        function: functionName,
        available: AVAILABLE_FUNCTIONS,
      }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Route to the actual function
  return routeToFunction(functionName, req);
}

Deno.serve(handler);
