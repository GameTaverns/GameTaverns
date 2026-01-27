// Main router for SELF-HOSTED deployments only
// In Lovable Cloud, each function is deployed independently and this file is just a stub

// Static imports - Deno edge-runtime doesn't support dynamic imports reliably
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

// Route map for self-hosted function routing
const functionHandlers: Record<string, (req: Request) => Promise<Response>> = {
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

const AVAILABLE_FUNCTIONS = Object.keys(functionHandlers);

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const functionName = pathParts[0];

  if (!functionName) {
    return new Response(
      JSON.stringify({ error: "Function name required", available: AVAILABLE_FUNCTIONS }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const handler = functionHandlers[functionName];
  
  if (!handler) {
    return new Response(
      JSON.stringify({ error: `Unknown function: ${functionName}`, available: AVAILABLE_FUNCTIONS }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    return await handler(req);
  } catch (error) {
    console.error(`Error in function ${functionName}:`, error);
    return new Response(
      JSON.stringify({ 
        error: `Function ${functionName} failed`,
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// For Lovable Cloud deployment (this becomes a standalone stub)
Deno.serve(handler);
