// Inlined handlers for self-hosted edge function router
// These are lazy-loaded by the main router (index.ts) on first request.
// Each export name must match the camelCase version of the function name.
// e.g. "totp-status" -> export totpStatus

import { createClient } from "npm:@supabase/supabase-js@2";
import * as OTPAuth from "npm:otpauth@9.4.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============================================================================
// AI CLIENT (from _shared/ai-client.ts)
// ============================================================================
interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface AITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface AIRequestOptions {
  messages: AIMessage[];
  model?: string;
  max_tokens?: number;
  tools?: AITool[];
  tool_choice?: { type: "function"; function: { name: string } };
}

interface AIResponse {
  success: boolean;
  content?: string;
  toolCallArguments?: Record<string, unknown>;
  error?: string;
  rateLimited?: boolean;
}

function getAIConfig(): { endpoint: string; apiKey: string; model: string; provider: string } | null {
  const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
  if (perplexityKey) {
    return { endpoint: "https://api.perplexity.ai/chat/completions", apiKey: perplexityKey, model: "sonar", provider: "perplexity" };
  }
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    return { endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions", apiKey: lovableKey, model: "google/gemini-2.5-flash", provider: "lovable" };
  }
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (openaiKey) {
    return { endpoint: "https://api.openai.com/v1/chat/completions", apiKey: openaiKey, model: "gpt-4o-mini", provider: "openai" };
  }
  return null;
}

function isAIConfigured(): boolean {
  return getAIConfig() !== null;
}

function getAIProviderName(): string {
  if (Deno.env.get("PERPLEXITY_API_KEY")) return "Perplexity";
  if (Deno.env.get("LOVABLE_API_KEY")) return "Lovable AI";
  if (Deno.env.get("OPENAI_API_KEY")) return "OpenAI";
  return "None";
}

async function aiComplete(options: AIRequestOptions): Promise<AIResponse> {
  const config = getAIConfig();
  if (!config) {
    return { success: false, error: "AI service not configured." };
  }
  try {
    const requestBody: Record<string, unknown> = { model: options.model || config.model, messages: options.messages };
    if (options.max_tokens) requestBody.max_tokens = options.max_tokens;
    if (options.tools) requestBody.tools = options.tools;
    if (options.tool_choice) requestBody.tool_choice = options.tool_choice;

    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI API error (${response.status}):`, errorText);
      return { success: false, error: `AI request failed: ${response.status}`, rateLimited: response.status === 429 };
    }
    const data = await response.json();
    const choices = data.choices as Array<Record<string, unknown>> | undefined;
    const choice = choices?.[0];
    if (!choice) return { success: false, error: "No response from AI" };
    const message = choice.message as Record<string, unknown> | undefined;
    const toolCalls = message?.tool_calls as Array<Record<string, unknown>> | undefined;
    const toolCall = toolCalls?.[0];
    if (toolCall) {
      const func = toolCall.function as Record<string, unknown> | undefined;
      if (func?.arguments) {
        try {
          const args = JSON.parse(func.arguments as string);
          return { success: true, toolCallArguments: args };
        } catch { return { success: false, error: "Failed to parse tool call arguments" }; }
      }
    }
    const content = message?.content as string | undefined;
    if (content) return { success: true, content };
    return { success: false, error: "Empty response from AI" };
  } catch (e) {
    console.error("AI request error:", e);
    return { success: false, error: e instanceof Error ? e.message : "AI request failed" };
  }
}

// ============================================================================
// SMTP HELPERS (used by signup)
// ============================================================================
const SMTP_SEND_TIMEOUT_MS = 8000;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function sendEmailSafely(sendFn: () => Promise<void>) {
  (async () => {
    try {
      await withTimeout(sendFn(), SMTP_SEND_TIMEOUT_MS, "SMTP send");
    } catch (e) {
      console.error("SMTP send failed (non-blocking):", e);
    }
  })();
}

function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getSmtpClient() {
  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
  const smtpUser = Deno.env.get("SMTP_USER") || "";
  const smtpPass = Deno.env.get("SMTP_PASS") || "";
  const smtpFrom = Deno.env.get("SMTP_FROM");
  const requiresAuth = smtpPort !== 25;
  if (!smtpHost || !smtpFrom) {
    throw new Error("Email service not configured (missing SMTP_HOST/SMTP_FROM)");
  }
  if (requiresAuth && (!smtpUser || !smtpPass)) {
    throw new Error("Email service not configured (missing SMTP_USER/SMTP_PASS)");
  }
  const isPlainRelay = smtpPort === 25;
  const connection: any = { hostname: smtpHost, port: smtpPort, tls: smtpPort === 465 };
  if (requiresAuth) {
    connection.auth = { username: smtpUser, password: smtpPass };
  }
  const client = new SMTPClient({
    connection,
    ...(isPlainRelay ? { debug: { allowUnsecure: true, noStartTLS: true } } : {}),
  });
  return { client, smtpFrom };
}

async function sendConfirmationEmail(params: { email: string; confirmUrl: string }) {
  const { client, smtpFrom } = getSmtpClient();
  const fromAddress = `GameTaverns <${smtpFrom}>`;
  await client.send({
    from: fromAddress,
    to: params.email,
    subject: "Confirm Your GameTaverns Account",
    content: `Confirm your email by visiting: ${params.confirmUrl}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #1a1510; font-family: Georgia, serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1510; padding: 40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color: #2a2015; border-radius: 8px; overflow: hidden;">
        <tr><td style="background: linear-gradient(135deg, #8B4513 0%, #654321 100%); padding: 30px; text-align: center;">
          <img src="https://ddfslywzgddlpmkhohfu.supabase.co/storage/v1/object/public/library-logos/platform-logo.png" alt="GameTaverns" style="max-height: 60px; width: auto; margin-bottom: 10px;" />
          <h1 style="color: #f5f0e6; margin: 0; font-size: 28px; font-weight: bold;">GameTaverns</h1>
        </td></tr>
        <tr><td style="padding: 40px 30px;">
          <h2 style="color: #f5f0e6; margin: 0 0 20px 0; font-size: 24px;">Welcome to GameTaverns!</h2>
          <p style="color: #c9bfb0; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Thanks for signing up! Please confirm your email address to activate your account.</p>
          <table cellpadding="0" cellspacing="0" style="margin: 30px 0;"><tr>
            <td style="background: linear-gradient(135deg, #d97706 0%, #b45309 100%); border-radius: 6px;">
              <a href="${params.confirmUrl}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 16px;">Confirm Email</a>
            </td>
          </tr></table>
          <p style="color: #8b7355; font-size: 14px; line-height: 1.5; margin: 0;">This link will expire in 24 hours.</p>
        </td></tr>
        <tr><td style="background-color: #1a1510; padding: 20px 30px; text-align: center; border-top: 1px solid #3d3425;">
          <p style="color: #6b5b4a; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} GameTaverns. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
  await client.close();
}

// ============================================================================
// IMPORTANT: The actual handler implementations below are extracted from the
// old monolithic main/index.ts. On the server, this file should be created by
// copying lines 154-2949 from the old router.
//
// Since the full handler code is ~2800 lines and was only visible on the server,
// this file serves as the TEMPLATE. The user must copy the handler functions
// from their server's backup of the old main/index.ts.
//
// INSTRUCTIONS FOR SERVER:
// 1. The old main/index.ts is at /opt/gametaverns/supabase/functions/main/index.ts
//    (it hasn't been updated yet - only the repo copy changed)
// 2. Extract lines 154-2949 and paste them below, converting each
//    "async function handleXxx" to "export async function xxx"
//
// EXPORT NAME MAPPING (function-name -> export name):
//   totp-status      -> totpStatus
//   totp-setup       -> totpSetup
//   totp-verify      -> totpVerify
//   totp-disable     -> totpDisable
//   manage-users     -> manageUsers
//   wishlist         -> wishlist
//   rate-game        -> rateGame
//   discord-config   -> discordConfig
//   discord-unlink   -> discordUnlink
//   image-proxy      -> imageProxy
//   manage-account   -> manageAccount
//   refresh-images   -> refreshImages
//   signup           -> signup
//   game-recommendations -> gameRecommendations
//   resolve-username -> resolveUsername
//   sync-achievements -> syncAchievements
//   discord-notify   -> discordNotify
//   discord-create-event -> discordCreateEvent
//   discord-forum-post -> discordForumPost
//   discord-delete-thread -> discordDeleteThread
//   discord-oauth-callback -> discordOauthCallback
//   discord-send-dm  -> discordSendDm
// ============================================================================

// PLACEHOLDER: Replace with actual handler implementations from server backup.
// The handlers need the corsHeaders, createClient, OTPAuth, and AI functions above.

// To generate this file automatically on the server, run:
// cd /opt/gametaverns/supabase/functions/main
// cp index.ts index.ts.old
// # Then use the extraction script provided

export async function totpStatus(req: Request): Promise<Response> {
  // Will be populated from server backup
  return new Response("Handler not yet extracted", { status: 501 });
}
export async function totpSetup(req: Request): Promise<Response> {
  return new Response("Handler not yet extracted", { status: 501 });
}
export async function totpVerify(req: Request): Promise<Response> {
  return new Response("Handler not yet extracted", { status: 501 });
}
export async function totpDisable(req: Request): Promise<Response> {
  return new Response("Handler not yet extracted", { status: 501 });
}
export async function manageUsers(req: Request): Promise<Response> {
  return new Response("Handler not yet extracted", { status: 501 });
}
export async function wishlist(req: Request): Promise<Response> {
  return new Response("Handler not yet extracted", { status: 501 });
}
export async function rateGame(req: Request): Promise<Response> {
  return new Response("Handler not yet extracted", { status: 501 });
}
export async function discordConfig(req: Request): Promise<Response> {
  return new Response("Handler not yet extracted", { status: 501 });
}
export async function discordUnlink(req: Request): Promise<Response> {
  return new Response("Handler not yet extracted", { status: 501 });
}
export async function imageProxy(req: Request): Promise<Response> {
  return new Response("Handler not yet extracted", { status: 501 });
}
export async function manageAccount(req: Request): Promise<Response> {
  return new Response("Handler not yet extracted", { status: 501 });
}
export async function refreshImages(req: Request): Promise<Response> {
  return new Response("Handler not yet extracted", { status: 501 });
}
export async function signup(req: Request): Promise<Response> {
  return new Response("Handler not yet extracted", { status: 501 });
}
export async function gameRecommendations(req: Request): Promise<Response> {
  return new Response("Handler not yet extracted", { status: 501 });
}
export async function resolveUsername(req: Request): Promise<Response> {
  return new Response("Handler not yet extracted", { status: 501 });
}
export async function syncAchievements(req: Request): Promise<Response> {
  return new Response("Handler not yet extracted", { status: 501 });
}
export async function discordNotify(req: Request): Promise<Response> {
  return new Response("Handler not yet extracted", { status: 501 });
}
export async function discordCreateEvent(req: Request): Promise<Response> {
  return new Response("Handler not yet extracted", { status: 501 });
}
export async function discordForumPost(req: Request): Promise<Response> {
  return new Response("Handler not yet extracted", { status: 501 });
}
export async function discordDeleteThread(req: Request): Promise<Response> {
  return new Response("Handler not yet extracted", { status: 501 });
}
export async function discordOauthCallback(req: Request): Promise<Response> {
  return new Response("Handler not yet extracted", { status: 501 });
}
export async function discordSendDm(req: Request): Promise<Response> {
  return new Response("Handler not yet extracted", { status: 501 });
}
