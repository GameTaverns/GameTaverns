// Main entry point for self-hosted Supabase Edge Functions
// This router dispatches requests to individual functions using static imports
// Dynamic imports don't work reliably in edge-runtime, so we use static imports

import bggImportHandler from "../bgg-import/index.ts";
import bggLookupHandler from "../bgg-lookup/index.ts";
import bulkImportHandler from "../bulk-import/index.ts";
import condenseDescriptionsHandler from "../condense-descriptions/index.ts";
import decryptMessagesHandler from "../decrypt-messages/index.ts";
import gameImportHandler from "../game-import/index.ts";
import imageProxyHandler from "../image-proxy/index.ts";
import manageUsersHandler from "../manage-users/index.ts";
import rateGameHandler from "../rate-game/index.ts";
import sendEmailHandler from "../send-email/index.ts";
import sendMessageHandler from "../send-message/index.ts";
import wishlistHandler from "../wishlist/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Handler = (req: Request) => Response | Promise<Response>;

const FUNCTIONS: Record<string, Handler> = {
  "bgg-import": bggImportHandler,
  "bgg-lookup": bggLookupHandler,
  "bulk-import": bulkImportHandler,
  "condense-descriptions": condenseDescriptionsHandler,
  "decrypt-messages": decryptMessagesHandler,
  "game-import": gameImportHandler,
  "image-proxy": imageProxyHandler,
  "manage-users": manageUsersHandler,
  "rate-game": rateGameHandler,
  "send-email": sendEmailHandler,
  "send-message": sendMessageHandler,
  "wishlist": wishlistHandler,
};

const FUNCTION_NAMES = Object.keys(FUNCTIONS);

// Export handler for self-hosted router (in case this is nested)
export default async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  
  // Expected path: /functionName or /functionName/...
  const functionName = pathParts[0];
  
  if (!functionName) {
    return new Response(
      JSON.stringify({ error: "Function name required", available: FUNCTION_NAMES }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const fnHandler = FUNCTIONS[functionName];
  if (!fnHandler) {
    return new Response(
      JSON.stringify({ error: `Unknown function: ${functionName}`, available: FUNCTION_NAMES }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    return await fnHandler(req);
  } catch (error) {
    console.error(`Error in function ${functionName}:`, error);
    return new Response(
      JSON.stringify({ 
        error: `Function error: ${functionName}`,
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// For Lovable Cloud deployment (direct function invocation)
Deno.serve(handler);
