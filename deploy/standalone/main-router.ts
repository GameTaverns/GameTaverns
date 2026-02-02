// Self-hosted router - mounted over supabase/functions/main/index.ts at runtime
// This file contains static imports that work in edge-runtime but would fail in Lovable Cloud bundling
// Version: 2.3.1 - Complete function registry

import bggImportHandler from "../bgg-import/index.ts";
import bggLookupHandler from "../bgg-lookup/index.ts";
import bulkImportHandler from "../bulk-import/index.ts";
import condenseDescriptionsHandler from "../condense-descriptions/index.ts";
import decryptMessagesHandler from "../decrypt-messages/index.ts";
import discordConfigHandler from "../discord-config/index.ts";
import discordCreateEventHandler from "../discord-create-event/index.ts";
import discordDeleteThreadHandler from "../discord-delete-thread/index.ts";
import discordForumPostHandler from "../discord-forum-post/index.ts";
import discordNotifyHandler from "../discord-notify/index.ts";
import discordOauthCallbackHandler from "../discord-oauth-callback/index.ts";
import discordSendDmHandler from "../discord-send-dm/index.ts";
import discordUnlinkHandler from "../discord-unlink/index.ts";
import gameImportHandler from "../game-import/index.ts";
import gameRecommendationsHandler from "../game-recommendations/index.ts";
import imageProxyHandler from "../image-proxy/index.ts";
import manageAccountHandler from "../manage-account/index.ts";
import manageUsersHandler from "../manage-users/index.ts";
import rateGameHandler from "../rate-game/index.ts";
import refreshImagesHandler from "../refresh-images/index.ts";
import resolveUsernameHandler from "../resolve-username/index.ts";
import sendAuthEmailHandler from "../send-auth-email/index.ts";
import sendEmailHandler from "../send-email/index.ts";
import sendMessageHandler from "../send-message/index.ts";
import signupHandler from "../signup/index.ts";
import syncAchievementsHandler from "../sync-achievements/index.ts";
import totpDisableHandler from "../totp-disable/index.ts";
import totpSetupHandler from "../totp-setup/index.ts";
import totpStatusHandler from "../totp-status/index.ts";
import totpVerifyHandler from "../totp-verify/index.ts";
import verifyEmailHandler from "../verify-email/index.ts";
import verifyResetTokenHandler from "../verify-reset-token/index.ts";
import wishlistHandler from "../wishlist/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Route map for self-hosted function routing
const functionHandlers: Record<string, (req: Request) => Promise<Response>> = {
  // BGG Import
  "bgg-import": bggImportHandler,
  "bgg-lookup": bggLookupHandler,
  "bulk-import": bulkImportHandler,
  
  // Game management
  "condense-descriptions": condenseDescriptionsHandler,
  "game-import": gameImportHandler,
  "game-recommendations": gameRecommendationsHandler,
  "refresh-images": refreshImagesHandler,
  
  // Discord integration
  "discord-config": discordConfigHandler,
  "discord-create-event": discordCreateEventHandler,
  "discord-delete-thread": discordDeleteThreadHandler,
  "discord-forum-post": discordForumPostHandler,
  "discord-notify": discordNotifyHandler,
  "discord-oauth-callback": discordOauthCallbackHandler,
  "discord-send-dm": discordSendDmHandler,
  "discord-unlink": discordUnlinkHandler,
  
  // Messaging
  "decrypt-messages": decryptMessagesHandler,
  "send-email": sendEmailHandler,
  "send-message": sendMessageHandler,
  "send-auth-email": sendAuthEmailHandler,
  
  // User management
  "manage-account": manageAccountHandler,
  "manage-users": manageUsersHandler,
  "resolve-username": resolveUsernameHandler,
  "signup": signupHandler,
  "verify-email": verifyEmailHandler,
  "verify-reset-token": verifyResetTokenHandler,
  
  // TOTP 2FA
  "totp-disable": totpDisableHandler,
  "totp-setup": totpSetupHandler,
  "totp-status": totpStatusHandler,
  "totp-verify": totpVerifyHandler,
  
  // Game features
  "image-proxy": imageProxyHandler,
  "rate-game": rateGameHandler,
  "wishlist": wishlistHandler,
  "sync-achievements": syncAchievementsHandler,
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
  
  // Nginx gateway strips /functions/v1/ prefix, so we receive:
  //   /<function-name>
  // But edge-runtime direct calls or Kong may still include the prefix:
  //   /functions/v1/<function-name>
  // Handle both cases.
  let functionName: string | undefined;
  if (pathParts[0] === "functions" && pathParts[1] === "v1") {
    functionName = pathParts[2];
  } else {
    functionName = pathParts[0];
  }
  console.log(`[main-router] Resolved function: ${functionName}`);

  if (!functionName) {
    return new Response(
      JSON.stringify({ 
        error: "Function name required", 
        available: AVAILABLE_FUNCTIONS,
        version: "2.3.1"
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const fnHandler = functionHandlers[functionName];
  
  if (!fnHandler) {
    return new Response(
      JSON.stringify({ 
        error: `Unknown function: ${functionName}`, 
        available: AVAILABLE_FUNCTIONS,
        version: "2.3.1"
      }),
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
