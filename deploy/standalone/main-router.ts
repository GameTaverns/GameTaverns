// Self-hosted router - mounted over supabase/functions/main/index.ts at runtime
// This file contains static imports that work in edge-runtime but would fail in Lovable Cloud bundling

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
  
  // Debug: Log incoming request details
  console.log(`[main-router] Request URL: ${req.url}`);
  console.log(`[main-router] Pathname: ${url.pathname}`);
  console.log(`[main-router] Path parts: ${JSON.stringify(pathParts)}`);
  
  const functionName = pathParts[0];
  console.log(`[main-router] Resolved function: ${functionName}`);

  if (!functionName) {
    return new Response(
      JSON.stringify({ error: "Function name required", available: AVAILABLE_FUNCTIONS }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const fnHandler = functionHandlers[functionName];
  
  if (!fnHandler) {
    return new Response(
      JSON.stringify({ error: `Unknown function: ${functionName}`, available: AVAILABLE_FUNCTIONS }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    return await fnHandler(req);
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

Deno.serve(handler);
