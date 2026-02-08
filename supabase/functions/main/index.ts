// Main router for self-hosted deployments
// Since edge-runtime can only serve ONE main service directory,
// all functions must be inlined here for self-hosted multi-function support.
// For Lovable Cloud, each function is deployed independently.

import { createClient } from "npm:@supabase/supabase-js@2";
import * as OTPAuth from "npm:otpauth@9.4.0";

// Self-hosted router delegates many functions to their regular implementations.
// These modules must guard `Deno.serve(...)` behind `import.meta.main`.
import bggImportHandler from "../bgg-import/index.ts";
import bggLookupHandler from "../bgg-lookup/index.ts";
import gameImportHandler from "../game-import/index.ts";

// Router-compatible exported handlers
import verifyEmailHandler from "../verify-email/index.ts";
import verifyResetTokenHandler from "../verify-reset-token/index.ts";
import sendAuthEmailHandler from "../send-auth-email/index.ts";
import sendMessageHandler from "../send-message/index.ts";
import myInquiriesHandler from "../my-inquiries/index.ts";
import replyToInquiryHandler from "../reply-to-inquiry/index.ts";
import condenseDescriptionsHandler from "../condense-descriptions/index.ts";
import decryptMessagesHandler from "../decrypt-messages/index.ts";
import membershipHandler from "../membership/index.ts";
import librarySettingsHandler from "../library-settings/index.ts";
import profileUpdateHandler from "../profile-update/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============================================================================
// INLINED AI CLIENT (from _shared/ai-client.ts)
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

// Get vision-capable AI config (excludes Perplexity which doesn't support images)
function getVisionAIConfig(): { endpoint: string; apiKey: string; model: string; provider: string } | null {
  // Google AI API (Gemini) - most cost-effective vision option
  const googleAIKey = Deno.env.get("GOOGLE_AI_API_KEY");
  if (googleAIKey) {
    return { 
      endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", 
      apiKey: googleAIKey, 
      model: "gemini-2.5-flash", 
      provider: "google" 
    };
  }
  // Lovable AI with Gemini supports vision
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    return { 
      endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions", 
      apiKey: lovableKey, 
      model: "google/gemini-2.5-flash", 
      provider: "lovable" 
    };
  }
  // OpenAI GPT-4o supports vision
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (openaiKey) {
    return { 
      endpoint: "https://api.openai.com/v1/chat/completions", 
      apiKey: openaiKey, 
      model: "gpt-4o", 
      provider: "openai" 
    };
  }
  return null;
}

// Classify images using vision AI to identify gameplay/component photos
async function classifyGameplayImages(
  imageUrls: string[],
  maxToReturn = 5
): Promise<string[]> {
  const visionConfig = getVisionAIConfig();
  if (!visionConfig || imageUrls.length === 0) {
    console.log("[BulkImport] No vision AI available, using URL-pattern filtering");
    return imageUrls.slice(0, maxToReturn);
  }

  console.log(`[BulkImport] Classifying ${imageUrls.length} images with ${visionConfig.provider} vision`);
  
  const scoredImages: { url: string; score: number }[] = [];
  
  // Process images in batches to avoid rate limits
  const batchSize = 3;
  for (let i = 0; i < imageUrls.length && scoredImages.length < maxToReturn * 2; i += batchSize) {
    const batch = imageUrls.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (url) => {
      try {
        const response = await fetch(visionConfig.endpoint, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${visionConfig.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: visionConfig.model,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Rate this board game image 1-10 for how useful it is to understand the game. High scores (7-10): gameplay in progress, game components, cards/tokens spread out, player perspective. Medium scores (4-6): box art variants, setup photos, close-ups of single components. Low scores (1-3): promotional graphics, logos, unrelated images, blurry/low-quality. Respond with ONLY a number 1-10.`
                  },
                  {
                    type: "image_url",
                    image_url: { url }
                  }
                ]
              }
            ],
            max_tokens: 10,
          }),
        });

        if (!response.ok) {
          console.warn(`[BulkImport] Vision API returned ${response.status} for image`);
          return { url, score: 5 }; // Default middle score on error
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim() || "5";
        const score = parseInt(content.match(/\d+/)?.[0] || "5", 10);
        
        console.log(`[BulkImport] Image scored ${score}/10: ${url.slice(-50)}`);
        return { url, score: Math.min(10, Math.max(1, score)) };
      } catch (e) {
        console.warn(`[BulkImport] Vision classification failed for image:`, e);
        return { url, score: 5 };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    scoredImages.push(...batchResults);
    
    // Small delay between batches to be nice to API
    if (i + batchSize < imageUrls.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // Sort by score descending and take top N
  scoredImages.sort((a, b) => b.score - a.score);
  const topImages = scoredImages.slice(0, maxToReturn).map(s => s.url);
  
  console.log(`[BulkImport] Selected ${topImages.length} top-scoring images (scores: ${scoredImages.slice(0, maxToReturn).map(s => s.score).join(", ")})`);
  return topImages;
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
// TOTP STATUS HANDLER
// ============================================================================
async function handleTotpStatus(req: Request): Promise<Response> {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: totpSettings, error: fetchError } = await adminClient
      .from("user_totp_settings")
      .select("is_enabled, verified_at, backup_codes_encrypted")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.error("Fetch error:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch TOTP status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let remainingBackupCodes = 0;
    if (totpSettings?.backup_codes_encrypted) {
      try {
        const codes = JSON.parse(totpSettings.backup_codes_encrypted);
        remainingBackupCodes = Array.isArray(codes) ? codes.length : 0;
      } catch { /* ignore */ }
    }

    return new Response(
      JSON.stringify({
        isEnabled: totpSettings?.is_enabled ?? false,
        verifiedAt: totpSettings?.verified_at ?? null,
        remainingBackupCodes,
        requiresSetup: !totpSettings?.is_enabled,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("TOTP status error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// TOTP SETUP HANDLER
// ============================================================================
async function handleTotpSetup(req: Request): Promise<Response> {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { action } = await req.json();

    if (action === "generate") {
      const secret = new OTPAuth.Secret({ size: 20 });
      const issuer = "GameTaverns";
      const label = user.email || user.id;
      
      const totp = new OTPAuth.TOTP({
        issuer,
        label,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret,
      });

      const otpauthUri = totp.toString();
      
      const backupCodes: string[] = [];
      for (let i = 0; i < 8; i++) {
        const code = crypto.getRandomValues(new Uint8Array(4));
        backupCodes.push(Array.from(code).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase());
      }

      const hashedBackupCodes = await Promise.all(
        backupCodes.map(async (code) => {
          const encoder = new TextEncoder();
          const data = encoder.encode(code);
          const hashBuffer = await crypto.subtle.digest("SHA-256", data);
          return Array.from(new Uint8Array(hashBuffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        })
      );

      const { error: upsertError } = await adminClient
        .from("user_totp_settings")
        .upsert({
          user_id: user.id,
          totp_secret_encrypted: secret.base32,
          backup_codes_encrypted: JSON.stringify(hashedBackupCodes),
          is_enabled: false,
          verified_at: null,
        }, { onConflict: "user_id" });

      if (upsertError) {
        console.error("Upsert error:", upsertError);
        return new Response(
          JSON.stringify({ error: "Failed to save TOTP settings" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          otpauthUri,
          secret: secret.base32,
          backupCodes,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("TOTP setup error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// TOTP VERIFY HANDLER
// ============================================================================
async function handleTotpVerify(req: Request): Promise<Response> {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { code, action } = await req.json();

    if (!code || typeof code !== "string") {
      return new Response(
        JSON.stringify({ error: "Code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: totpSettings, error: fetchError } = await adminClient
      .from("user_totp_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (fetchError || !totpSettings) {
      return new Response(
        JSON.stringify({ error: "TOTP not set up for this user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedCode = code.replace(/\s|-/g, "").toUpperCase();
    
    // Check backup code
    if (normalizedCode.length === 8) {
      const encoder = new TextEncoder();
      const data = encoder.encode(normalizedCode);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashedInput = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const storedHashes: string[] = JSON.parse(totpSettings.backup_codes_encrypted || "[]");
      const backupCodeIndex = storedHashes.findIndex((h) => h === hashedInput);

      if (backupCodeIndex !== -1) {
        storedHashes.splice(backupCodeIndex, 1);
        
        await adminClient
          .from("user_totp_settings")
          .update({ backup_codes_encrypted: JSON.stringify(storedHashes) })
          .eq("user_id", user.id);

        if (action === "setup") {
          await adminClient
            .from("user_totp_settings")
            .update({ is_enabled: true, verified_at: new Date().toISOString() })
            .eq("user_id", user.id);
        }

        return new Response(
          JSON.stringify({ 
            valid: true, 
            method: "backup_code",
            remaining_backup_codes: storedHashes.length 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Verify TOTP
    const totp = new OTPAuth.TOTP({
      issuer: "GameTaverns",
      label: user.email || user.id,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(totpSettings.totp_secret_encrypted),
    });

    const delta = totp.validate({ token: normalizedCode, window: 1 });

    if (delta === null) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "setup" && !totpSettings.is_enabled) {
      await adminClient
        .from("user_totp_settings")
        .update({ is_enabled: true, verified_at: new Date().toISOString() })
        .eq("user_id", user.id);
    }

    return new Response(
      JSON.stringify({ valid: true, method: "totp" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("TOTP verify error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// TOTP DISABLE HANDLER
// ============================================================================
async function handleTotpDisable(req: Request): Promise<Response> {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { code } = await req.json();

    if (!code || typeof code !== "string") {
      return new Response(
        JSON.stringify({ error: "Current TOTP code is required to disable 2FA" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: totpSettings, error: fetchError } = await adminClient
      .from("user_totp_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (fetchError || !totpSettings || !totpSettings.is_enabled) {
      return new Response(
        JSON.stringify({ error: "2FA is not enabled for this account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totp = new OTPAuth.TOTP({
      issuer: "GameTaverns",
      label: user.email || user.id,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(totpSettings.totp_secret_encrypted),
    });

    const normalizedCode = code.replace(/\s|-/g, "");
    const delta = totp.validate({ token: normalizedCode, window: 1 });

    if (delta === null) {
      return new Response(
        JSON.stringify({ error: "Invalid code. Please enter a valid authenticator code." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: deleteError } = await adminClient
      .from("user_totp_settings")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to disable 2FA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Two-factor authentication has been disabled" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("TOTP disable error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// MANAGE-USERS HANDLER (Admin user management)
// ============================================================================
async function handleManageUsers(req: Request): Promise<Response> {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Only admins can manage users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { action, email, password, role, userId, duration, reason } = body;
    
    if (!action) {
      return new Response(
        JSON.stringify({ error: "Missing 'action' field in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    switch (action) {
      case "create": {
        if (!email || !password) {
          return new Response(
            JSON.stringify({ error: "Email and password are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

        if (createError) {
          return new Response(
            JSON.stringify({ error: createError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (role && role !== "user" && newUser.user) {
          await adminClient.from("user_roles").insert({ user_id: newUser.user.id, role });
        }

        return new Response(
          JSON.stringify({ success: true, user: { id: newUser.user?.id, email: newUser.user?.email } }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete": {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "User ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (userId === user.id) {
          return new Response(
            JSON.stringify({ error: "Cannot delete your own account" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await adminClient.from("user_roles").delete().eq("user_id", userId);
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

        if (deleteError) {
          return new Response(
            JSON.stringify({ error: deleteError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "list": {
        const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();

        if (listError) {
          return new Response(
            JSON.stringify({ error: listError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: roles } = await adminClient.from("user_roles").select("user_id, role");
        const { data: profiles } = await adminClient.from("user_profiles").select("user_id, display_name, username");
        const { data: libraryOwners } = await adminClient.from("libraries").select("owner_id");
        const libraryOwnerSet = new Set(libraryOwners?.map((l) => l.owner_id) || []);

        const { data: libraryModerators } = await adminClient
          .from("library_members")
          .select("user_id")
          .eq("role", "moderator");
        const libraryModeratorSet = new Set(libraryModerators?.map((m) => m.user_id) || []);

        const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]) || []);
        const profileMap = new Map(profiles?.map((p) => [p.user_id, { display_name: p.display_name, username: p.username }]) || []);
        
        const usersWithRoles = users.map((u) => {
          let effectiveRole = roleMap.get(u.id) || null;
          if (!effectiveRole && libraryOwnerSet.has(u.id)) {
            effectiveRole = "owner";
          } else if (!effectiveRole && libraryModeratorSet.has(u.id)) {
            effectiveRole = "moderator";
          }
          
          return {
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
            role: effectiveRole,
            display_name: profileMap.get(u.id)?.display_name || null,
            username: profileMap.get(u.id)?.username || null,
            is_banned: u.banned_until ? new Date(u.banned_until) > new Date() : false,
            banned_until: u.banned_until,
            is_library_owner: libraryOwnerSet.has(u.id),
            is_library_moderator: libraryModeratorSet.has(u.id),
          };
        });

        return new Response(
          JSON.stringify({ users: usersWithRoles }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "suspend": {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "User ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (userId === user.id) {
          return new Response(
            JSON.stringify({ error: "Cannot suspend your own account" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        let banDuration: string;
        if (duration === "permanent") {
          banDuration = "876000h";
        } else if (duration === "7d") {
          banDuration = "168h";
        } else if (duration === "30d") {
          banDuration = "720h";
        } else if (duration === "90d") {
          banDuration = "2160h";
        } else {
          banDuration = "168h";
        }

        const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: banDuration,
          user_metadata: reason ? { suspension_reason: reason } : undefined,
        });

        if (updateError) {
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "unsuspend": {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "User ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: "none",
        });

        if (updateError) {
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("Error in manage-users:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// WISHLIST HANDLER
// ============================================================================
interface WishlistRequest {
  action: "add" | "remove" | "list";
  game_id?: string;
  guest_name?: string;
  guest_identifier: string;
}

async function handleWishlist(req: Request): Promise<Response> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: WishlistRequest = await req.json();
    const { action, game_id, guest_name, guest_identifier } = body;

    // Validate guest_identifier
    if (!guest_identifier || guest_identifier.length < 8 || guest_identifier.length > 64) {
      return new Response(
        JSON.stringify({ error: "Invalid guest identifier" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate guest_name if provided (max 50 chars, no HTML)
    const sanitizedName = guest_name 
      ? guest_name.trim().slice(0, 50).replace(/<[^>]*>/g, '')
      : null;

    if (action === "add") {
      if (!game_id || !/^[0-9a-f-]{36}$/i.test(game_id)) {
        return new Response(
          JSON.stringify({ error: "Invalid game ID" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("game_wishlist")
        .upsert(
          {
            game_id,
            guest_name: sanitizedName,
            guest_identifier,
          },
          { onConflict: "game_id,guest_identifier" }
        );

      if (error) throw error;

      // Fire Discord notification (fire-and-forget)
      try {
        const { data: game } = await supabase
          .from("games")
          .select("title, image_url, library_id")
          .eq("id", game_id)
          .single();

        if (game?.library_id) {
          const { count } = await supabase
            .from("game_wishlist")
            .select("*", { count: "exact", head: true })
            .eq("game_id", game_id);

          fetch(`${supabaseUrl}/functions/v1/discord-notify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              library_id: game.library_id,
              event_type: "wishlist_vote",
              data: {
                game_title: game.title,
                image_url: game.image_url,
                vote_count: count || 1,
                voter_name: sanitizedName,
              },
            }),
          }).catch(err => console.error("Discord notify failed:", err));
        }
      } catch (notifyError) {
        console.error("Failed to send Discord notification:", notifyError);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Vote added" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "remove") {
      if (!game_id || !/^[0-9a-f-]{36}$/i.test(game_id)) {
        return new Response(
          JSON.stringify({ error: "Invalid game ID" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("game_wishlist")
        .delete()
        .eq("game_id", game_id)
        .eq("guest_identifier", guest_identifier);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: "Vote removed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list") {
      const { data, error } = await supabase
        .from("game_wishlist")
        .select("game_id")
        .eq("guest_identifier", guest_identifier);

      if (error) throw error;

      return new Response(
        JSON.stringify({ votes: data?.map(v => v.game_id) || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Wishlist error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// RATE-GAME HANDLER
// ============================================================================
async function handleRateGame(req: Request): Promise<Response> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // GET: Fetch user's own ratings by guestIdentifier
    if (req.method === "GET") {
      const url = new URL(req.url);
      // Support both query param and header for guestIdentifier
      const guestIdentifier = url.searchParams.get("guestIdentifier") || req.headers.get("x-guest-identifier");
      
      if (!guestIdentifier) {
        return new Response(
          JSON.stringify({ error: "Missing guestIdentifier" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const { data, error } = await supabase
        .from("game_ratings")
        .select("game_id, rating")
        .eq("guest_identifier", guestIdentifier);
      
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

    // DELETE: Remove a rating
    if (req.method === "DELETE") {
      const { gameId, guestIdentifier } = await req.json();

      if (!gameId || !guestIdentifier) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("game_ratings")
        .delete()
        .eq("game_id", gameId)
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

    // POST: Submit or update a rating
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    // Support both camelCase (frontend) and snake_case (legacy)
    const game_id = body.game_id || body.gameId;
    const rating = body.rating;
    const guest_identifier = body.guest_identifier || body.guestIdentifier;
    const device_fingerprint = body.device_fingerprint || body.deviceFingerprint || req.headers.get("x-device-fingerprint");

    if (!game_id || !rating || !guest_identifier) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (rating < 1 || rating > 5) {
      return new Response(
        JSON.stringify({ error: "Rating must be between 1 and 5" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get client IP from various headers
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                     req.headers.get("x-real-ip") ||
                     req.headers.get("cf-connecting-ip") ||
                     null;

    const { data, error } = await supabase
      .from("game_ratings")
      .upsert(
        {
          game_id,
          rating: Math.round(rating),
          guest_identifier,
          device_fingerprint: device_fingerprint || null,
          ip_address: clientIp,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "game_id,guest_identifier" }
      )
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

  } catch (error) {
    console.error("Rate game error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// DISCORD-CONFIG HANDLER
// ============================================================================
async function handleDiscordConfig(req: Request): Promise<Response> {
  try {
    const clientId = Deno.env.get("DISCORD_CLIENT_ID");

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "Discord integration not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CRITICAL: For Discord OAuth, we MUST use a consistent redirect_uri.
    // Always prefer APP_URL when set, because:
    // 1. The browser Origin could be a tenant subdomain (tzolaks-tavern.gametaverns.com)
    // 2. The callback from Discord has NO Origin header
    // 3. Discord requires EXACT match between authorize and token exchange
    const appUrl = Deno.env.get("APP_URL");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    // Use APP_URL first if configured, otherwise fall back to other options
    const xfHost = req.headers.get("x-forwarded-host");
    const xfProto = req.headers.get("x-forwarded-proto") || "https";

    const baseUrl =
      appUrl ||
      (xfHost ? `${xfProto}://${xfHost}` : null) ||
      supabaseUrl ||
      null;

    if (!baseUrl) {
      return new Response(
        JSON.stringify({ error: "Server URL not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[discord-config] Using redirect base URL:", baseUrl);

    return new Response(
      JSON.stringify({
        client_id: clientId,
        redirect_uri: `${baseUrl.replace(/\/$/, "")}/functions/v1/discord-oauth-callback`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Discord config error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// DISCORD-UNLINK HANDLER
// ============================================================================
async function handleDiscordUnlink(req: Request): Promise<Response> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ discord_user_id: null })
      .eq("user_id", user.id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to unlink Discord account" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Discord unlink error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// IMAGE-PROXY HANDLER
// ============================================================================

// Browser-like headers required for BGG CDN - they block requests without proper Referer/Origin
function browserLikeHeaders(): Record<string, string> {
  return {
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Referer": "https://boardgamegeek.com/",
    "Origin": "https://boardgamegeek.com",
    "Sec-Fetch-Dest": "image",
    "Sec-Fetch-Mode": "no-cors",
    "Sec-Fetch-Site": "cross-site",
  };
}

async function handleImageProxy(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const imageUrl = url.searchParams.get("url");

  if (!imageUrl) {
    return new Response("Missing 'url' parameter", { status: 400, headers: corsHeaders });
  }

  try {
    // Normalize problematic encoding - BGG CDN expects literal (unencoded) parentheses
    let normalizedUrl = imageUrl
      .replace(/&quot;.*$/, "")
      .replace(/[;,]+$/, "")
      .replace(/[\s\u0000-\u001F]+$/g, "")
      .replace(/%2528/gi, "(")
      .replace(/%2529/gi, ")")
      .replace(/%28/gi, "(")
      .replace(/%29/gi, ")");

    const decodedUrl = decodeURIComponent(normalizedUrl);
    
    // Security: Only allow specific domains
    const allowedDomains = [
      "cf.geekdo-images.com",
      "cf.geekdo-static.com",
      "images.unsplash.com",
    ];

    const urlObj = new URL(decodedUrl);
    if (!allowedDomains.some(d => urlObj.hostname.endsWith(d))) {
      return new Response("Domain not allowed", { status: 403, headers: corsHeaders });
    }

    const response = await fetch(decodedUrl, {
      method: "GET",
      headers: browserLikeHeaders(),
      redirect: "follow",
    });

    if (!response.ok) {
      console.log(`image-proxy: fetch failed for ${decodedUrl} with status ${response.status}`);
      return new Response("Failed to fetch image", { status: response.status, headers: corsHeaders });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Image proxy error:", error);
    return new Response("Failed to proxy image", { status: 500, headers: corsHeaders });
  }
}

// ============================================================================
// MANAGE-ACCOUNT HANDLER (Clear library, delete library, delete account)
// ============================================================================
async function handleManageAccount(req: Request): Promise<Response> {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // supabase-js v2 reads the JWT from the Authorization header.
    // Passing the token as an argument can fail depending on the runtime/build.
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { action, libraryId, confirmationText } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Missing 'action' field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action !== "delete_account" && !libraryId) {
      return new Response(
        JSON.stringify({ error: "Missing 'libraryId' field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's library to verify ownership
    const { data: library, error: libraryError } = await userClient
      .from("libraries")
      .select("id, name, slug, owner_id")
      .eq("id", libraryId)
      .single();

    if (libraryError && action !== "delete_account") {
      return new Response(
        JSON.stringify({ error: "Library not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify ownership (except for account deletion)
    if (action !== "delete_account" && library?.owner_id !== userId) {
      return new Response(
        JSON.stringify({ error: "Not authorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    switch (action) {
      case "clear_library": {
        if (!library) {
          return new Response(
            JSON.stringify({ error: "Library not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (confirmationText?.toLowerCase() !== library.name.toLowerCase()) {
          return new Response(
            JSON.stringify({ error: "Confirmation text does not match library name" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: gamesError } = await adminClient
          .from("games")
          .delete()
          .eq("library_id", libraryId);

        if (gamesError) {
          console.error("Error clearing games:", gamesError);
          return new Response(
            JSON.stringify({ error: "Failed to clear library games" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await adminClient.from("import_jobs").delete().eq("library_id", libraryId);

        return new Response(
          JSON.stringify({ success: true, message: "Library games cleared successfully" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete_library": {
        if (!library) {
          return new Response(
            JSON.stringify({ error: "Library not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (confirmationText?.toLowerCase() !== library.name.toLowerCase()) {
          return new Response(
            JSON.stringify({ error: "Confirmation text does not match library name" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await adminClient.from("library_settings").delete().eq("library_id", libraryId);
        await adminClient.from("library_suspensions").delete().eq("library_id", libraryId);
        await adminClient.from("import_jobs").delete().eq("library_id", libraryId);
        await adminClient.from("games").delete().eq("library_id", libraryId);

        const { error: deleteError } = await adminClient
          .from("libraries")
          .delete()
          .eq("id", libraryId);

        if (deleteError) {
          console.error("Error deleting library:", deleteError);
          return new Response(
            JSON.stringify({ error: "Failed to delete library" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        try {
          const { data: files } = await adminClient.storage.from("library-logos").list(libraryId);
          if (files && files.length > 0) {
            const filePaths = files.map((f) => `${libraryId}/${f.name}`);
            await adminClient.storage.from("library-logos").remove(filePaths);
          }
        } catch { /* non-fatal */ }

        return new Response(
          JSON.stringify({ success: true, message: "Library deleted successfully" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete_account": {
        if (confirmationText?.toLowerCase() !== user.email?.toLowerCase()) {
          return new Response(
            JSON.stringify({ error: "Confirmation text does not match email address" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: userLibraries } = await adminClient
          .from("libraries")
          .select("id")
          .eq("owner_id", userId);

        if (userLibraries) {
          for (const lib of userLibraries) {
            await adminClient.from("library_settings").delete().eq("library_id", lib.id);
            await adminClient.from("library_suspensions").delete().eq("library_id", lib.id);
            await adminClient.from("import_jobs").delete().eq("library_id", lib.id);
            await adminClient.from("games").delete().eq("library_id", lib.id);
            await adminClient.from("libraries").delete().eq("id", lib.id);

            try {
              const { data: files } = await adminClient.storage.from("library-logos").list(lib.id);
              if (files && files.length > 0) {
                const filePaths = files.map((f) => `${lib.id}/${f.name}`);
                await adminClient.storage.from("library-logos").remove(filePaths);
              }
            } catch { /* non-fatal */ }
          }
        }

        await adminClient.from("user_roles").delete().eq("user_id", userId);
        await adminClient.from("user_profiles").delete().eq("user_id", userId);

        const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
        if (deleteUserError) {
          console.error("Error deleting user:", deleteUserError);
          return new Response(
            JSON.stringify({ error: "Failed to delete account" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "Account deleted successfully" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Manage account error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// REFRESH-IMAGES HANDLER (Inlined for self-hosted)
// ============================================================================
async function fetchBGGImageDirect(bggUrl: string): Promise<string | null> {
  try {
    const pageRes = await fetch(bggUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });
    if (!pageRes.ok) return null;
    const html = await pageRes.text();
    
    // Try og:image first (but ignore opengraph/thumbnail variants)
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (ogMatch?.[1]?.includes("cf.geekdo-images.com") && !isLowQualityBggImageUrl(ogMatch[1])) {
      return ogMatch[1].trim();
    }
    
    // Fallback: find images
    const imageRegex = /https?:\/\/cf\.geekdo-images\.com[^\s"'<>]+/g;
    const images = html.match(imageRegex) || [];
    const filtered = [...new Set(images)].filter((img: string) => 
      !/crop100|square30|100x100|150x150|_thumb|_avatar|_micro/i.test(img)
    );
    filtered.sort((a: string, b: string) => {
      const prio = (url: string) => /_itemrep/i.test(url) ? 0 : /_imagepage/i.test(url) ? 1 : 2;
      return prio(a) - prio(b);
    });
    return filtered[0] || null;
  } catch { return null; }
}

async function handleRefreshImages(req: Request): Promise<Response> {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Authentication required" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: library } = await supabaseAdmin.from("libraries").select("id").eq("owner_id", user.id).maybeSingle();
    if (!library) {
      return new Response(JSON.stringify({ success: false, error: "You must own a library to refresh images" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const libraryId = body.library_id || library.id;
    const limit = body.limit || 50;

    // Find games with missing images (null OR empty string)
    const { data: games, error: gamesError } = await supabaseAdmin
      .from("games")
      .select("id, title, bgg_url, image_url")
      .eq("library_id", libraryId)
      .not("bgg_url", "is", null)
      .limit(limit);
    
    // Filter client-side:
    // - missing images (null/empty)
    // - OR low-quality/cropped BGG variants (opengraph/thumbnails)
    const gamesNeedingImages = (games || []).filter((g) => {
      const missing = !g.image_url || g.image_url.trim() === "" || g.image_url === "null";
      const lowQuality = isLowQualityBggImageUrl(g.image_url);
      return missing || lowQuality;
    });

    if (gamesError) {
      return new Response(JSON.stringify({ success: false, error: gamesError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (gamesNeedingImages.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No games need image refresh", updated: 0, remaining: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[RefreshImages] Processing ${gamesNeedingImages.length} games needing images`);
    let updated = 0, failed = 0;

    for (const game of gamesNeedingImages) {
      if (!game.bgg_url) continue;

      const imageUrlRaw = await fetchBGGImageDirect(game.bgg_url);
      const imageUrl = cleanBggImageUrl(imageUrlRaw ?? undefined);

      // Only update if we found something that isn't a known low-quality variant
      if (imageUrl && !isLowQualityBggImageUrl(imageUrl)) {
        const { error } = await supabaseAdmin.from("games").update({ image_url: imageUrl }).eq("id", game.id);
        if (!error) {
          updated++;
          console.log(`[RefreshImages] Updated: ${game.title}`);
        } else {
          failed++;
        }
      } else {
        failed++;
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    // Count remaining games with missing images
    const { data: allGamesWithBgg } = await supabaseAdmin
      .from("games")
      .select("id, image_url")
      .eq("library_id", libraryId)
      .not("bgg_url", "is", null);
    
    const remaining = (allGamesWithBgg || []).filter(g => 
      !g.image_url || g.image_url.trim() === "" || g.image_url === "null"
    ).length;

    return new Response(JSON.stringify({ success: true, updated, failed, processed: gamesNeedingImages.length, remaining }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[RefreshImages] Error:", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Failed to refresh images" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

// ============================================================================
// BGG ENRICHMENT HELPERS (for bulk-import)
// ============================================================================
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchBGGXMLData(bggId: string): Promise<{
  bgg_id: string;
  description?: string;
  image_url?: string;
  min_players?: number;
  max_players?: number;
  suggested_age?: string;
  play_time?: string;
  difficulty?: string;
  mechanics?: string[];
  publisher?: string;
} | null> {
  try {
    // BGG now requires authentication
    const bggApiToken = Deno.env.get("BGG_API_TOKEN");
    const headers: Record<string, string> = {
      "User-Agent": "GameTaverns/1.0 (Bulk Import)",
    };
    if (bggApiToken) {
      headers["Authorization"] = `Bearer ${bggApiToken}`;
    }
    
    const res = await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${bggId}&stats=1`, { headers });
    if (!res.ok) {
      console.warn(`[Main] BGG XML API returned ${res.status} for ${bggId}${!bggApiToken ? " (no BGG_API_TOKEN configured)" : ""}`);
      return { bgg_id: bggId };
    }
    const xml = await res.text();
    
    const imageMatch = xml.match(/<image>([^<]+)<\/image>/);
    const descMatch = xml.match(/<description>([^<]*)<\/description>/);
    const minPlayersMatch = xml.match(/<minplayers[^>]*value="(\d+)"/);
    const maxPlayersMatch = xml.match(/<maxplayers[^>]*value="(\d+)"/);
    const minAgeMatch = xml.match(/<minage[^>]*value="(\d+)"/);
    const playTimeMatch = xml.match(/<playingtime[^>]*value="(\d+)"/);
    const weightMatch = xml.match(/<averageweight[^>]*value="([\d.]+)"/);
    const mechanicsMatches = xml.matchAll(/<link[^>]*type="boardgamemechanic"[^>]*value="([^"]+)"/g);
    const mechanics = [...mechanicsMatches].map(m => m[1]);
    const publisherMatch = xml.match(/<link[^>]*type="boardgamepublisher"[^>]*value="([^"]+)"/);
    
    let difficulty: string | undefined;
    if (weightMatch) {
      const w = parseFloat(weightMatch[1]);
      if (w > 0) {
        if (w < 1.5) difficulty = "1 - Very Easy";
        else if (w < 2.25) difficulty = "2 - Easy";
        else if (w < 3.0) difficulty = "3 - Medium";
        else if (w < 3.75) difficulty = "4 - Hard";
        else difficulty = "5 - Very Hard";
      }
    }
    
    let play_time: string | undefined;
    if (playTimeMatch) {
      const minutes = parseInt(playTimeMatch[1], 10);
      if (minutes <= 30) play_time = "Under 30 Minutes";
      else if (minutes <= 45) play_time = "30-45 Minutes";
      else if (minutes <= 60) play_time = "45-60 Minutes";
      else if (minutes <= 90) play_time = "60-90 Minutes";
      else if (minutes <= 120) play_time = "90-120 Minutes";
      else if (minutes <= 180) play_time = "2-3 Hours";
      else play_time = "3+ Hours";
    }
    
    let description = descMatch?.[1];
    if (description) {
      description = description.replace(/&#10;/g, "\n").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").slice(0, 2000);
    }
    
    return {
      bgg_id: bggId,
      image_url: imageMatch?.[1],
      description,
      min_players: minPlayersMatch ? parseInt(minPlayersMatch[1], 10) : undefined,
      max_players: maxPlayersMatch ? parseInt(maxPlayersMatch[1], 10) : undefined,
      suggested_age: minAgeMatch ? `${minAgeMatch[1]}+` : undefined,
      play_time,
      difficulty,
      mechanics: mechanics.length > 0 ? mechanics : undefined,
      publisher: publisherMatch?.[1],
    };
  } catch (e) {
    console.error("[BulkImport] BGG XML fallback error:", e);
    return { bgg_id: bggId };
  }
}

async function fetchBGGDataWithFirecrawl(bggId: string, firecrawlKey: string, maxRetries = 2): Promise<{
  bgg_id: string;
  description?: string;
  image_url?: string;
  min_players?: number;
  max_players?: number;
  suggested_age?: string;
  play_time?: string;
  difficulty?: string;
  game_type?: string;
  mechanics?: string[];
  publisher?: string;
} | null> {
  const pageUrl = `https://boardgamegeek.com/boardgame/${bggId}`;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) await sleep(Math.min(1000 * Math.pow(2, attempt - 1), 4000));
      
      const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { "Authorization": `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: pageUrl, formats: ["markdown", "rawHtml"], onlyMainContent: true }),
      });
      
      if (!scrapeRes.ok) {
        if (scrapeRes.status === 429) await sleep(5000);
        continue;
      }
      
      const raw = await scrapeRes.text();
      if (!raw || raw.trim().length === 0) continue;
      
      let scrapeData: any;
      try { scrapeData = JSON.parse(raw); } catch { continue; }
      
      const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
      const rawHtml = scrapeData.data?.rawHtml || scrapeData.rawHtml || "";
      if (!markdown && !rawHtml) continue;
      
      // Extract image
      const imageRegex = /https?:\/\/cf\.geekdo-images\.com[^\s"'<>]+/g;
      const images: string[] = rawHtml.match(imageRegex) || [];
      const uniqueImages = [...new Set(images)] as string[];
      const filtered = uniqueImages.filter((img) => !/crop100|square30|100x100|_thumb|_avatar/i.test(img));
      filtered.sort((a, b) => {
        const prio = (url: string) => /_itemrep/i.test(url) ? 0 : /_imagepage/i.test(url) ? 1 : 2;
        return prio(a) - prio(b);
      });
      const mainImage: string | undefined = filtered[0] || undefined;
      
      // Try AI extraction if configured
      if (!isAIConfigured()) return { bgg_id: bggId, image_url: mainImage };
      
      try {
        const aiResult = await aiComplete({
          messages: [
            { role: "system", content: `Extract board game data. Use EXACT enum values:
- difficulty: "1 - Very Easy", "2 - Easy", "3 - Medium", "4 - Hard", "5 - Very Hard"
- play_time: "Under 30 Minutes", "30-45 Minutes", "45-60 Minutes", "60-90 Minutes", "90-120 Minutes", "2-3 Hours", "3+ Hours"
- game_type: "Board Game", "Card Game", "Dice Game", "Party Game", "Strategy Game", "Cooperative Game", "Miniatures Game", "Role-Playing Game", "Deck Building", "Area Control", "Worker Placement", "Other"
Create a comprehensive description (200-400 words) with overview and Quick Gameplay Overview section.` },
            { role: "user", content: `Extract data from:\n\n${markdown.slice(0, 12000)}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "extract_game",
              description: "Extract board game data",
              parameters: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  difficulty: { type: "string", enum: DIFFICULTY_LEVELS },
                  play_time: { type: "string", enum: PLAY_TIME_OPTIONS },
                  game_type: { type: "string", enum: GAME_TYPE_OPTIONS },
                  min_players: { type: "number" },
                  max_players: { type: "number" },
                  suggested_age: { type: "string" },
                  mechanics: { type: "array", items: { type: "string" } },
                  publisher: { type: "string" },
                },
                required: ["description"],
              },
            },
          }],
        });
        
        if (aiResult?.success && aiResult.toolCallArguments) {
          const data = aiResult.toolCallArguments as Record<string, unknown>;
          return {
            bgg_id: bggId,
            image_url: mainImage,
            description: data.description as string | undefined,
            difficulty: data.difficulty as string | undefined,
            play_time: data.play_time as string | undefined,
            game_type: data.game_type as string | undefined,
            min_players: data.min_players as number | undefined,
            max_players: data.max_players as number | undefined,
            suggested_age: data.suggested_age as string | undefined,
            mechanics: data.mechanics as string[] | undefined,
            publisher: data.publisher as string | undefined,
          };
        }
      } catch { /* AI failed, return with image only */ }
      
      return { bgg_id: bggId, image_url: mainImage };
    } catch (e) {
      console.warn(`[BulkImport] Firecrawl attempt ${attempt} failed:`, e);
    }
  }
  
  // Fallback to BGG XML API
  console.log(`[BulkImport] Firecrawl failed, using BGG XML fallback for ${bggId}`);
  return await fetchBGGXMLData(bggId);
}

// ============================================================================
// BULK-IMPORT HANDLER (Inlined for self-hosted)
// ============================================================================
// NOTE: Self-hosted schema enums differ from Cloud/UI enums.
// These values match deploy/supabase-selfhosted/migrations/02-enums.sql.
const DIFFICULTY_LEVELS = ["1 - Very Easy", "2 - Easy", "3 - Medium", "4 - Hard", "5 - Very Hard"];
const PLAY_TIME_OPTIONS = ["Under 30 Minutes", "30-45 Minutes", "45-60 Minutes", "60-90 Minutes", "90-120 Minutes", "2-3 Hours", "3+ Hours"];
const GAME_TYPE_OPTIONS = [
  "Board Game",
  "Card Game",
  "Dice Game",
  "Party Game",
  "Strategy Game",
  "Cooperative Game",
  "Miniatures Game",
  "Role-Playing Game",
  "Deck Building",
  "Area Control",
  "Worker Placement",
  "Other",
];

const normalizeEnum = (value: string | undefined, allowed: readonly string[]): string | undefined => {
  if (!value) return undefined;
  const v = value.trim();
  return allowed.includes(v) ? v : undefined;
};

const normalizeDifficulty = (difficulty: string | undefined): string | undefined => {
  if (!difficulty) return undefined;
  const d = difficulty.trim();
  const direct = normalizeEnum(d, DIFFICULTY_LEVELS);
  if (direct) return direct;

  // Map Cloud/UI difficulty values into self-hosted enum
  const cloudToSelf: Record<string, string> = {
    "1 - Light": "1 - Very Easy",
    "2 - Medium Light": "2 - Easy",
    "3 - Medium": "3 - Medium",
    "4 - Medium Heavy": "4 - Hard",
    "5 - Heavy": "5 - Very Hard",
  };
  return normalizeEnum(cloudToSelf[d], DIFFICULTY_LEVELS);
};

const normalizePlayTime = (playTime: string | undefined): string | undefined => {
  if (!playTime) return undefined;
  const p = playTime.trim();
  const direct = normalizeEnum(p, PLAY_TIME_OPTIONS);
  if (direct) return direct;

  // Map Cloud/UI play time values into self-hosted enum
  const cloudToSelf: Record<string, string> = {
    "0-15 Minutes": "Under 30 Minutes",
    "15-30 Minutes": "Under 30 Minutes",
    "30-45 Minutes": "30-45 Minutes",
    "45-60 Minutes": "45-60 Minutes",
    "60+ Minutes": "60-90 Minutes",
    "2+ Hours": "2-3 Hours",
    "3+ Hours": "3+ Hours",
  };
  return normalizeEnum(cloudToSelf[p], PLAY_TIME_OPTIONS);
};

const normalizeGameType = (gameType: string | undefined): string | undefined => {
  if (!gameType) return undefined;
  const t = gameType.trim();
  const direct = normalizeEnum(t, GAME_TYPE_OPTIONS);
  if (direct) return direct;

  // Map common Cloud/UI values into self-hosted enum
  const cloudToSelf: Record<string, string> = {
    "Miniatures": "Miniatures Game",
    "RPG": "Role-Playing Game",
    "War Game": "Strategy Game",
  };
  return normalizeEnum(cloudToSelf[t], GAME_TYPE_OPTIONS);
};

const normalizeSaleCondition = (saleCondition: string | undefined): string | undefined => {
  if (!saleCondition) return undefined;
  const c = saleCondition.trim();
  if (c === "New/Sealed") return "New";
  return c;
};

function parseCSV(csvData: string): Record<string, string>[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  for (let i = 0; i < csvData.length; i++) {
    const char = csvData[i];
    const nextChar = csvData[i + 1];
    if (char === '"') {
      if (!inQuotes) inQuotes = true;
      else if (nextChar === '"') { currentField += '"'; i++; }
      else inQuotes = false;
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      if (char === '\r') i++;
      currentRow.push(currentField.trim());
      if (currentRow.some(f => f !== "")) rows.push(currentRow);
      currentRow = [];
      currentField = "";
    } else if (char === '\r' && !inQuotes) {
      currentRow.push(currentField.trim());
      if (currentRow.some(f => f !== "")) rows.push(currentRow);
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f !== "")) rows.push(currentRow);
  }
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.toLowerCase().trim());
  const result: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => { row[header] = values[idx] || ""; });
    result.push(row);
  }
  return result;
}

const parseBool = (val: string | undefined): boolean => {
  if (!val) return false;
  const v = val.toLowerCase().trim();
  return v === "true" || v === "yes" || v === "1";
};

const parseNum = (val: string | undefined): number | undefined => {
  if (!val) return undefined;
  const n = parseInt(val, 10);
  return isNaN(n) ? undefined : n;
};

const parsePrice = (val: string | undefined): number | undefined => {
  if (!val) return undefined;
  const cleaned = val.replace(/[^0-9.,]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? undefined : n;
};

const parseDate = (val: string | undefined): string | undefined => {
  if (!val) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const date = new Date(val);
  if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  return undefined;
};

const mapWeightToDifficulty = (weight: string | undefined): string | undefined => {
  if (!weight) return undefined;
  const w = parseFloat(weight);
  if (isNaN(w) || w === 0) return undefined;
  if (w < 1.5) return "1 - Very Easy";
  if (w < 2.25) return "2 - Easy";
  if (w < 3.0) return "3 - Medium";
  if (w < 3.75) return "4 - Hard";
  return "5 - Very Hard";
};

const mapPlayTimeToEnum = (minutes: number | undefined): string | undefined => {
  if (!minutes) return undefined;
  if (minutes <= 30) return "Under 30 Minutes";
  if (minutes <= 45) return "30-45 Minutes";
  if (minutes <= 60) return "45-60 Minutes";
  if (minutes <= 90) return "60-90 Minutes";
  if (minutes <= 120) return "90-120 Minutes";
  if (minutes <= 180) return "2-3 Hours";
  return "3+ Hours";
};

// Clean BoardGameGeek image URLs without changing their variant/path.
//
// IMPORTANT: Many BGG CDN URLs include signed/variant paths (e.g. __opengraph/img/...)
// that are REQUIRED for the asset to load. Stripping them down to /<key>/pic####.ext
// can cause the upstream CDN to return 400.
const cleanBggImageUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined;

  // Remove common scraping artifacts + normalize parentheses encoding.
  // (We intentionally do NOT rewrite the path beyond this.)
  const cleaned = url
    .replace(/%28/g, "(")
    .replace(/%29/g, ")")
    .replace(/%2528/g, "(")
    .replace(/%2529/g, ")")
    .replace(/&quot;.*$/, "")
    .replace(/[\s\u0000-\u001F]+$/g, "")
    .replace(/[;,]+$/g, "")
    .trim();

  return cleaned.length ? cleaned : undefined;
};

// Fetch gallery/gameplay images from BGG.
//
// Primary strategy: Firecrawl scrape (rawHtml).
// Fallback strategy: Directly fetch the BGG /images page and extract cf.geekdo-images.com URLs.
//
// Rationale: Firecrawl can hit 402 (insufficient credits) during large imports, but we still want
// gallery images whenever the BGG page is reachable.
async function fetchBGGGalleryImages(
  bggId: string,
  firecrawlKey: string,
  maxImages = 5
): Promise<string[]> {
  const galleryUrl = `https://boardgamegeek.com/boardgame/${bggId}/images`;

  const extractFromHtml = async (rawHtml: string, sourceLabel: string): Promise<string[]> => {
    console.log(`[Gallery] ${sourceLabel} HTML content length: ${rawHtml.length} chars`);
    if (!rawHtml) return [];

    // Extract all BGG CDN image URLs
    const imageRegex = /https?:\/\/cf\.geekdo-images\.com[^\s"'<>]+/g;
    const allImages = rawHtml.match(imageRegex) || [];
    const uniqueImages = [...new Set(allImages)] as string[];
    console.log(`[Gallery] ${sourceLabel} found ${allImages.length} total images, ${uniqueImages.length} unique`);

    // Filter out thumbnails, avatars, and very small images
    const filtered = uniqueImages.filter((img: string) => {
      // Exclude small images
      if (/crop100|square30|100x100|150x150|_thumb|_avatar|_micro|square100|_mt|_t$/i.test(img)) {
        return false;
      }
      // Exclude main box art (we get that from main image)
      if (/_itemrep/i.test(img)) {
        return false;
      }
      // Only include full-size images
      if (/_imagepage|_imagepagemedium|_md|_lg|_original/i.test(img)) {
        return true;
      }
      // Include if it doesn't have size suffix (could be original)
      if (!/_(mt|t|sq|th|md|lg)$/i.test(img)) {
        return true;
      }
      return false;
    });

    console.log(`[Gallery] ${sourceLabel} after filtering: ${filtered.length} candidate images`);

    // Prioritize larger/full images by URL pattern
    filtered.sort((a: string, b: string) => {
      const prio = (url: string) => {
        if (/_original/i.test(url)) return 0;
        if (/_imagepage(?!medium)/i.test(url)) return 1;
        if (/_imagepagemedium/i.test(url)) return 2;
        if (/_lg/i.test(url)) return 3;
        if (/_md/i.test(url)) return 4;
        return 5;
      };
      return prio(a) - prio(b);
    });

    // Clean URLs
    const cleanedUrls = filtered
      .map((url: string) => cleanBggImageUrl(url))
      .filter((url): url is string => !!url);

    console.log(`[Gallery] ${sourceLabel} after cleaning: ${cleanedUrls.length} valid URLs`);

    // Take more candidates for AI classification (or just maxImages if no AI)
    const candidates = cleanedUrls.slice(0, maxImages * 3);
    console.log(`[Gallery] ${sourceLabel} sending ${candidates.length} candidates to AI classification`);

    // Use AI vision to classify and pick the best gameplay images
    const result = await classifyGameplayImages(candidates, maxImages);
    console.log(`[Gallery] ${sourceLabel} final selection: ${result.length} images for BGG ID: ${bggId}`);

    return result;
  };

  const tryFirecrawl = async (): Promise<string[] | null> => {
    if (!firecrawlKey) {
      console.warn(`[Gallery] Firecrawl key missing; skipping Firecrawl scrape for ${bggId}`);
      return null;
    }

    try {
      console.log(`[Gallery] Fetching from: ${galleryUrl}`);
      console.log(`[Gallery] Firecrawl key present: true, key prefix: ${firecrawlKey.slice(0, 8)}...`);

      const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firecrawlKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: galleryUrl,
          formats: ["rawHtml"],
          onlyMainContent: false,
        }),
      });

      console.log(`[Gallery] Firecrawl response status: ${scrapeRes.status}`);

      if (!scrapeRes.ok) {
        const errorText = await scrapeRes.text();
        console.error(`[Gallery] Firecrawl error for ${bggId}: ${scrapeRes.status} - ${errorText.slice(0, 500)}`);
        return null;
      }

      const raw = await scrapeRes.text();
      console.log(`[Gallery] Firecrawl raw response length: ${raw?.length || 0} chars`);
      if (!raw || raw.trim().length === 0) {
        console.warn(`[Gallery] Empty response from Firecrawl for ${bggId}`);
        return null;
      }

      let scrapeData: any;
      try {
        scrapeData = JSON.parse(raw);
      } catch {
        console.error(`[Gallery] Failed to parse Firecrawl JSON for ${bggId}: ${raw.slice(0, 200)}`);
        return null;
      }

      const rawHtml = scrapeData.data?.rawHtml || scrapeData.rawHtml || "";
      if (!rawHtml) {
        console.warn(`[Gallery] No rawHtml in Firecrawl response for ${bggId}`);
        return null;
      }

      return await extractFromHtml(rawHtml, "Firecrawl");
    } catch (e) {
      console.error(`[Gallery] Firecrawl fetch error for ${bggId}:`, e);
      return null;
    }
  };

  const tryDirect = async (): Promise<string[]> => {
    try {
      console.log(`[Gallery] Direct-fetch fallback: ${galleryUrl}`);
      const pageRes = await fetch(galleryUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });

      console.log(`[Gallery] Direct-fetch status: ${pageRes.status}`);
      if (!pageRes.ok) {
        const snippet = (await pageRes.text().catch(() => "")).slice(0, 200);
        console.warn(`[Gallery] Direct-fetch failed for ${bggId}: ${pageRes.status} ${snippet}`);
        return [];
      }

      const html = await pageRes.text();
      return await extractFromHtml(html, "Direct");
    } catch (e) {
      console.error(`[Gallery] Direct-fetch error for ${bggId}:`, e);
      return [];
    }
  };

  // Try Firecrawl first (if available); fall back to direct fetch.
  const firecrawlResult = await tryFirecrawl();
  if (firecrawlResult && firecrawlResult.length > 0) return firecrawlResult;

  return await tryDirect();
}

// These often show up in CSV exports (especially opengraph 1200x630) and should
// be replaced with the canonical <image> URL from the BGG XML API when possible.
const isLowQualityBggImageUrl = (url: string | undefined): boolean => {
  if (!url) return true;
  return /(__opengraph|__opengraph_letterbox|__thumb|__micro|__small|__avatar|crop100|square30|100x100|150x150|fit-in\/1200x630)/i.test(url);
};

const buildDescription = (description: string | undefined, privateComment: string | undefined): string | undefined => {
  const desc = description?.trim();
  const notes = privateComment?.trim();
  if (!desc && !notes) return undefined;
  if (!notes) return desc;
  if (!desc) return `**Notes:** ${notes}`;
  return `${desc}\n\n**Notes:** ${notes}`;
};

// Fetch BGG collection for a user (same-origin self-hosted support)
async function fetchBGGCollection(username: string): Promise<{ id: string; name: string }[]> {
  const collectionUrl = `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(username)}&own=1&excludesubtype=boardgameexpansion`;
  
  // BGG now requires an API token for access
  const bggToken = Deno.env.get("BGG_API_TOKEN");
  
  const headers: Record<string, string> = {
    "User-Agent": "GameTaverns/1.0 (Collection Import)",
    "Accept": "application/xml",
  };
  
  // Add authorization if token is configured
  if (bggToken) {
    headers["Authorization"] = `Bearer ${bggToken}`;
  }
  
  let attempts = 0;
  while (attempts < 5) {
    const res = await fetch(collectionUrl, { headers });
    
    if (res.status === 202) {
      // BGG is processing the request, wait and retry
      await new Promise(r => setTimeout(r, 3000));
      attempts++;
      continue;
    }
    
    if (res.status === 401) {
      // BGG now requires API registration and tokens
      throw new Error(
        "BGG API requires authentication. Please ensure BGG_API_TOKEN is configured in your server .env file. As an alternative, export your collection as CSV from BoardGameGeek (Collection → Export) and use the CSV import option."
      );
    }
    
    if (res.status === 404 || res.status === 400) {
      throw new Error(`BGG username "${username}" not found or collection is private. Please check the username is correct and your collection is public.`);
    }
    
    if (!res.ok) {
      throw new Error(`Failed to fetch BGG collection (status ${res.status}). Please try again or use CSV import.`);
    }
    
    const xml = await res.text();
    
    // Check for error messages in the response
    if (xml.includes("<error>") || xml.includes("Invalid username")) {
      throw new Error(`BGG username "${username}" not found. Please check the username is correct.`);
    }
    
    const games: { id: string; name: string }[] = [];
    
    const itemRegex = /<item[^>]*objectid="(\d+)"[^>]*>[\s\S]*?<name[^>]*>([^<]+)<\/name>[\s\S]*?<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      games.push({ id: match[1], name: match[2] });
    }
    
    if (games.length === 0 && xml.includes("<items")) {
      // Empty collection - valid but no owned games
      console.log(`[BulkImport] BGG collection for ${username} is empty or has no owned games`);
    }
    
    return games;
  }
  
  throw new Error("BGG collection request timed out. The collection may be too large - please try using CSV export instead.");
}

type GameToImport = {
  title: string;
  bgg_id?: string;
  bgg_url?: string;
  type?: string;
  difficulty?: string;
  play_time?: string;
  min_players?: number;
  max_players?: number;
  suggested_age?: string;
  publisher?: string;
  mechanics?: string[];
  is_expansion?: boolean;
  parent_game?: string;
  is_coming_soon?: boolean;
  is_for_sale?: boolean;
  sale_price?: number;
  sale_condition?: string;
  location_room?: string;
  location_shelf?: string;
  location_misc?: string;
  sleeved?: boolean;
  upgraded_components?: boolean;
  crowdfunded?: boolean;
  inserts?: boolean;
  in_base_game_box?: boolean;
  description?: string;
  image_url?: string;
  additional_images?: string[];
  purchase_date?: string;
  purchase_price?: number;
};

async function handleBulkImport(req: Request): Promise<Response> {
  console.log("[BulkImport] Handler started");
  try {
    const authHeader = req.headers.get("Authorization");
    console.log("[BulkImport] Auth header present:", !!authHeader);
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("[BulkImport] FAIL: No auth header");
      return new Response(JSON.stringify({ success: false, error: "Authentication required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    console.log("[BulkImport] Supabase URL:", supabaseUrl?.slice(0, 30) + "...");

    const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    console.log("[BulkImport] User:", user?.id, "Error:", userError?.message);
    if (userError || !user) {
      console.log("[BulkImport] FAIL: Invalid auth, userError:", userError);
      return new Response(JSON.stringify({ success: false, error: "Invalid authentication" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = user.id;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    const { data: libraryData } = await supabaseAdmin.from("libraries").select("id").eq("owner_id", userId).maybeSingle();
    console.log("[BulkImport] Role:", roleData, "Library:", libraryData);
    if (!roleData && !libraryData) {
      console.log("[BulkImport] FAIL: No role and no library");
      return new Response(JSON.stringify({ success: false, error: "You must own a library to import games" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Defensive JSON parsing - handle empty/truncated request bodies.
    // This fixes intermittent `Unexpected end of JSON input` crashes in edge-runtime.
    let body: any;
    try {
      const rawBody = await req.text();
      if (!rawBody || rawBody.trim().length === 0) {
        console.log("[BulkImport] FAIL: Empty request body");
        return new Response(
          JSON.stringify({ success: false, error: "Empty request body" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.log("[BulkImport] FAIL: Invalid JSON body", parseError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { mode, library_id, csv_data, bgg_username, bgg_links, default_options, enhance_with_bgg } = body;
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    console.log("[BulkImport] Mode:", mode, "library_id:", library_id, "csv_data length:", csv_data?.length, "bgg_username:", bgg_username);
    console.log("[BulkImport] enhance_with_bgg:", enhance_with_bgg, "firecrawlKey present:", !!firecrawlKey, "AI configured:", isAIConfigured());
    const targetLibraryId = library_id || libraryData?.id;
    if (!targetLibraryId) {
      console.log("[BulkImport] FAIL: No library specified");
      return new Response(JSON.stringify({ success: false, error: "No library specified" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let gamesToImport: GameToImport[] = [];

    if (mode === "csv" && csv_data) {
      const rows = parseCSV(csv_data);
      console.log("[BulkImport] Parsed rows:", rows.length);
      const isBGGExport = rows.length > 0 && rows[0].objectname !== undefined;
      console.log("[BulkImport] Is BGG export:", isBGGExport);
      for (const row of rows) {
        const title = row.title || row.name || row.game || row["game name"] || row["game title"] || row.objectname;
        if (isBGGExport && row.own !== "1") continue;
        if (title) {
          const mechanicsStr = row.mechanics || row.mechanic || "";
          const mechanics = mechanicsStr.split(";").map((m: string) => m.trim()).filter((m: string) => m.length > 0);
          const bggId = row.bgg_id || row["bgg id"] || row.objectid || undefined;
          const minPlayersRaw = row.min_players || row["min players"] || row.minplayers;
          const maxPlayersRaw = row.max_players || row["max players"] || row.maxplayers;
          const playTimeRaw = row.play_time || row["play time"] || row.playtime || row.playingtime;
          const isExpansion = parseBool(row.is_expansion || row["is expansion"]) || row.itemtype === "expansion" || row.objecttype === "expansion";
          let difficulty: string | undefined = row.difficulty;
          if (!difficulty) difficulty = mapWeightToDifficulty(row.avgweight || row.weight);
          let playTime: string | undefined = row.play_time || row["play time"];
          if (!playTime && playTimeRaw) {
            const playTimeNum = parseNum(playTimeRaw);
            playTime = mapPlayTimeToEnum(playTimeNum);
          }
          const suggestedAge = row.suggested_age || row["suggested age"] || row.age || row.bggrecagerange || undefined;
          const isForSale = parseBool(row.is_for_sale || row["is for sale"] || row.fortrade);
          gamesToImport.push({
            title,
            bgg_id: bggId,
            bgg_url: bggId ? `https://boardgamegeek.com/boardgame/${bggId}` : (row.bgg_url || row["bgg url"] || row.url || undefined),
            type: row.type || row["game type"] || row.game_type || undefined,
            difficulty,
            play_time: playTime,
            min_players: parseNum(minPlayersRaw),
            max_players: parseNum(maxPlayersRaw),
            suggested_age: suggestedAge,
            publisher: row.publisher || undefined,
            mechanics: mechanics.length > 0 ? mechanics : undefined,
            is_expansion: isExpansion,
            parent_game: row.parent_game || row["parent game"] || undefined,
            is_coming_soon: parseBool(row.is_coming_soon || row["is coming soon"]),
            is_for_sale: isForSale,
            sale_price: parseNum(row.sale_price || row["sale price"]),
            sale_condition: row.sale_condition || row["sale condition"] || undefined,
            location_room: row.location_room || row["location room"] || undefined,
            location_shelf: row.location_shelf || row["location shelf"] || row.invlocation || undefined,
            location_misc: row.location_misc || row["location misc"] || undefined,
            sleeved: parseBool(row.sleeved),
            upgraded_components: parseBool(row.upgraded_components || row["upgraded components"]),
            crowdfunded: parseBool(row.crowdfunded),
            inserts: parseBool(row.inserts),
            in_base_game_box: parseBool(row.in_base_game_box || row["in base game box"]),
            description: buildDescription(row.description, row.privatecomment),
            image_url: cleanBggImageUrl(row.image_url || row["image url"] || row.thumbnail || undefined),
            // Parse additional_images from semicolon-separated list and clean URLs
            additional_images: (() => {
              const raw = row.additional_images || row["additional images"] || row.additionalimages || "";
              if (!raw) return undefined;
              const urls = raw.split(";").map((s: string) => cleanBggImageUrl(s.trim())).filter((u: string | undefined): u is string => !!u);
              return urls.length > 0 ? urls : undefined;
            })(),
            purchase_date: parseDate(row.acquisitiondate || row.acquisition_date || row.purchase_date),
            purchase_price: parsePrice(row.pricepaid || row.price_paid || row.purchase_price),
          });
        }
      }
      console.log("[BulkImport] Games to import:", gamesToImport.length);
    } else if (mode === "bgg_collection" && bgg_username) {
      // BGG Collection import via username (requires BGG_API_TOKEN in server .env)
      console.log(`[BulkImport] Fetching BGG collection for: ${bgg_username}`);
      try {
        const collection = await fetchBGGCollection(bgg_username);
        console.log(`[BulkImport] Found ${collection.length} games in collection`);
        
        for (const game of collection) {
          gamesToImport.push({
            title: game.name,
            bgg_id: game.id,
            bgg_url: `https://boardgamegeek.com/boardgame/${game.id}`,
          });
        }
      } catch (collectionError: unknown) {
        const errorMessage = collectionError instanceof Error ? collectionError.message : "Failed to fetch BGG collection";
        console.error("[BulkImport] BGG collection fetch error:", errorMessage);
        return new Response(JSON.stringify({ success: false, error: errorMessage }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else if (mode === "bgg_links" && bgg_links && bgg_links.length > 0) {
      // BGG Links import (paste URLs)
      console.log(`[BulkImport] Processing ${bgg_links.length} BGG links`);
      for (const link of bgg_links) {
        const idMatch = link.match(/boardgame\/(\d+)/);
        if (idMatch) {
          gamesToImport.push({
            title: "",
            bgg_id: idMatch[1],
            bgg_url: link,
          });
        }
      }
    } else {
      console.log("[BulkImport] FAIL: Invalid mode or missing data. mode=", mode, "csv_data:", !!csv_data, "bgg_username:", !!bgg_username, "bgg_links:", !!bgg_links);
      return new Response(JSON.stringify({ success: false, error: "Invalid import mode or missing data" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const totalGames = gamesToImport.length;
    console.log("[BulkImport] Total games to process:", totalGames);
    console.log("[BulkImport] Creating import job for library:", targetLibraryId);
    
    const { data: job, error: jobError } = await supabaseAdmin.from("import_jobs").insert({ library_id: targetLibraryId, status: "processing", total_items: totalGames, processed_items: 0, successful_items: 0, failed_items: 0 }).select("id").single();
    if (jobError || !job) {
      console.error("[BulkImport] Failed to create import job:", jobError);
      return new Response(JSON.stringify({ success: false, error: "Failed to create import job" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const jobId = job.id;
    console.log("[BulkImport] Created job:", jobId, "- starting SSE stream");

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendProgress = (data: Record<string, unknown>) => { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); };
        let imported = 0;
        let failed = 0;
        const errors: string[] = [];
        const importedGames: { title: string; id?: string }[] = [];
        
        // Track failure reasons
        const failureBreakdown = { already_exists: 0, missing_title: 0, create_failed: 0, exception: 0 };
        
        const debugPayload = {
          enhance_with_bgg: enhance_with_bgg !== false,
          firecrawl_key_present: Boolean(firecrawlKey),
          ai_configured: isAIConfigured(),
          ai_provider: getAIProviderName(),
          vision_ai_available: getVisionAIConfig() !== null,
          vision_ai_provider: getVisionAIConfig()?.provider || "none",
          bgg_api_token_present: Boolean(Deno.env.get("BGG_API_TOKEN")),
          debug_version: "bulk-import-2026-02-08-v5-vision-classify",
        };

        console.log("[BulkImport] Sending SSE start event");
        sendProgress({ type: "start", jobId, total: totalGames, debug: debugPayload });
        for (let i = 0; i < gamesToImport.length; i++) {
          const gameInput = gamesToImport[i];
          console.log(`[BulkImport] Processing game ${i + 1}/${totalGames}: ${gameInput.title}`);
          try {
            // Extract BGG ID from URL if not provided directly
            let effectiveBggId = gameInput.bgg_id;
            if (!effectiveBggId && gameInput.bgg_url) {
              const bggUrlMatch = gameInput.bgg_url.match(/boardgamegeek\.com\/boardgame\/(\d+)/);
              if (bggUrlMatch) {
                effectiveBggId = bggUrlMatch[1];
                console.log(`[BulkImport] Extracted BGG ID ${effectiveBggId} from URL for "${gameInput.title}"`);
              }
            }
            
            // Check if we need enrichment - triggers for low-quality images OR missing gallery images
            const hasLowQualityImage = isLowQualityBggImageUrl(gameInput.image_url);
            const needsGalleryImages = !gameInput.additional_images || gameInput.additional_images.length === 0;
            const shouldEnrich = !!(enhance_with_bgg && effectiveBggId && (hasLowQualityImage || needsGalleryImages));
            
            sendProgress({ 
              type: "progress", 
              current: i + 1, 
              total: totalGames, 
              imported, 
              failed, 
              currentGame: gameInput.title || `BGG ID: ${effectiveBggId}`, 
              phase: shouldEnrich ? "enhancing" : "importing" 
            });
            
            // Enrich with BGG data if needed (uses effectiveBggId extracted from URL if needed)
            let enrichedData: typeof gameInput = { ...gameInput };
            if (shouldEnrich && effectiveBggId) {
              console.log(`[BulkImport] Enriching with BGG: ${effectiveBggId} (extracted from URL: ${!gameInput.bgg_id})`);
              try {
                let bggData: Awaited<ReturnType<typeof fetchBGGDataWithFirecrawl>> | null = null;
                if (firecrawlKey) {
                  bggData = await fetchBGGDataWithFirecrawl(effectiveBggId, firecrawlKey);
                } else {
                  bggData = await fetchBGGXMLData(effectiveBggId);
                }
                if (bggData) {
                  const isEmpty = (val: unknown): boolean => val === undefined || val === null || val === "";

                  const bggImageClean = cleanBggImageUrl(bggData.image_url);
                  const shouldUseBggImage =
                    isEmpty(gameInput.image_url) || (bggImageClean && isLowQualityBggImageUrl(gameInput.image_url));

                  enrichedData = {
                    ...gameInput,
                    bgg_id: effectiveBggId, // Store the extracted BGG ID
                    image_url: shouldUseBggImage ? bggImageClean : gameInput.image_url,
                    description: isEmpty(gameInput.description) ? bggData.description : gameInput.description,
                    difficulty: isEmpty(gameInput.difficulty) ? bggData.difficulty : gameInput.difficulty,
                    play_time: isEmpty(gameInput.play_time) ? bggData.play_time : gameInput.play_time,
                    type: isEmpty(gameInput.type) ? bggData.game_type : gameInput.type,
                    min_players: gameInput.min_players ?? bggData.min_players,
                    max_players: gameInput.max_players ?? bggData.max_players,
                    suggested_age: isEmpty(gameInput.suggested_age) ? bggData.suggested_age : gameInput.suggested_age,
                    mechanics: gameInput.mechanics?.length ? gameInput.mechanics : bggData.mechanics,
                    publisher: isEmpty(gameInput.publisher) ? bggData.publisher : gameInput.publisher,
                  };
                  console.log(
                    `[BulkImport] Enriched ${gameInput.title}: image=${!!enrichedData.image_url} (usedBgg=${shouldUseBggImage}), desc=${enrichedData.description?.length || 0} chars`
                  );
                }
              } catch (e) {
                console.warn(`[BulkImport] Enrichment failed for ${effectiveBggId}:`, e);
              }
            }
            
            // ALWAYS fetch gallery images when we have Firecrawl + BGG ID + no existing gallery
            // This runs independently of the enhance_with_bgg flag for main data enrichment
            const hasGalleryImages = enrichedData.additional_images && enrichedData.additional_images.length > 0;
            console.log(`[BulkImport] Gallery check for "${gameInput.title}": firecrawlKey=${!!firecrawlKey}, hasGalleryImages=${hasGalleryImages}, bggId=${effectiveBggId}, enhance_with_bgg=${enhance_with_bgg}`);
            
            if (firecrawlKey && !hasGalleryImages && effectiveBggId) {
              console.log(`[BulkImport] Fetching gallery images for: ${gameInput.title} (BGG ID: ${effectiveBggId})`);
              try {
                const galleryImages = await fetchBGGGalleryImages(effectiveBggId, firecrawlKey, 5);
                console.log(`[BulkImport] fetchBGGGalleryImages returned ${galleryImages.length} images for "${gameInput.title}"`);
                if (galleryImages.length > 0) {
                  enrichedData.additional_images = galleryImages;
                  console.log(`[BulkImport] Added ${galleryImages.length} gallery images for "${gameInput.title}": ${galleryImages.slice(0, 2).join(', ')}...`);
                } else {
                  console.warn(`[BulkImport] No gallery images returned for "${gameInput.title}"`);
                }
              } catch (e) {
                console.error(`[BulkImport] Gallery fetch failed for ${gameInput.title}:`, e);
              }
            } else if (!firecrawlKey) {
              console.log(`[BulkImport] Skipping gallery fetch - no FIRECRAWL_API_KEY`);
            } else if (!effectiveBggId) {
              console.log(`[BulkImport] Skipping gallery fetch for "${gameInput.title}" - no BGG ID`);
            } else if (hasGalleryImages) {
              console.log(`[BulkImport] Skipping gallery fetch for "${gameInput.title}" - already has ${enrichedData.additional_images?.length} images`);
            }
            
            if (!enrichedData.title) { 
              failed++; 
              failureBreakdown.missing_title++;
              errors.push(`Could not determine title for game`); 
              continue; 
            }

            const { data: existing } = await supabaseAdmin.from("games").select("id, title").eq("title", enrichedData.title).eq("library_id", targetLibraryId).maybeSingle();
            if (existing) { 
              failed++; 
              failureBreakdown.already_exists++;
              errors.push(`"${enrichedData.title}" already exists`); 
              continue; 
            }

            const mechanicIds: string[] = [];
            if (enrichedData.mechanics?.length) {
              for (const name of enrichedData.mechanics) {
                const { data: em } = await supabaseAdmin.from("mechanics").select("id").eq("name", name).maybeSingle();
                if (em) { mechanicIds.push(em.id); }
                else {
                  const { data: nm } = await supabaseAdmin.from("mechanics").insert({ name }).select("id").single();
                  if (nm) mechanicIds.push(nm.id);
                }
              }
            }

            let publisherId: string | null = null;
            if (enrichedData.publisher) {
              const { data: ep } = await supabaseAdmin.from("publishers").select("id").eq("name", enrichedData.publisher).maybeSingle();
              if (ep) { publisherId = ep.id; }
              else {
                const { data: np } = await supabaseAdmin.from("publishers").insert({ name: enrichedData.publisher }).select("id").single();
                if (np) publisherId = np.id;
              }
            }

            let parentGameId: string | null = null;
            if (enrichedData.is_expansion && enrichedData.parent_game) {
              const { data: pg } = await supabaseAdmin.from("games").select("id").eq("title", enrichedData.parent_game).eq("library_id", targetLibraryId).maybeSingle();
              if (pg) { parentGameId = pg.id; }
            }

             // Normalize enums to match self-hosted DB enum values
             const normalizedDifficulty = normalizeDifficulty(enrichedData.difficulty) || "3 - Medium";
             const normalizedPlayTime = normalizePlayTime(enrichedData.play_time) || "45-60 Minutes";
             const normalizedGameType = normalizeGameType(enrichedData.type) || "Board Game";
             const normalizedSaleCondition = normalizeSaleCondition(enrichedData.sale_condition);

             const { data: newGame, error: gameError } = await supabaseAdmin.from("games").insert({
              library_id: targetLibraryId,
              title: enrichedData.title,
              description: enrichedData.description || null,
              image_url: enrichedData.image_url || null,
              bgg_id: enrichedData.bgg_id || null,
              bgg_url: enrichedData.bgg_url || null,
              min_players: enrichedData.min_players ?? 2,
              max_players: enrichedData.max_players ?? 4,
              suggested_age: enrichedData.suggested_age || null,
               play_time: normalizedPlayTime,
               difficulty: normalizedDifficulty,
               game_type: normalizedGameType,
              publisher_id: publisherId,
              is_expansion: enrichedData.is_expansion ?? false,
              parent_game_id: parentGameId,
              is_coming_soon: enrichedData.is_coming_soon ?? default_options?.is_coming_soon ?? false,
              is_for_sale: enrichedData.is_for_sale ?? default_options?.is_for_sale ?? false,
              sale_price: enrichedData.sale_price ?? default_options?.sale_price ?? null,
               sale_condition: normalizedSaleCondition ?? default_options?.sale_condition ?? null,
              location_room: enrichedData.location_room ?? default_options?.location_room ?? null,
              location_shelf: enrichedData.location_shelf ?? default_options?.location_shelf ?? null,
              location_misc: enrichedData.location_misc ?? default_options?.location_misc ?? null,
              sleeved: enrichedData.sleeved ?? default_options?.sleeved ?? false,
              upgraded_components: enrichedData.upgraded_components ?? default_options?.upgraded_components ?? false,
              crowdfunded: enrichedData.crowdfunded ?? default_options?.crowdfunded ?? false,
              inserts: enrichedData.inserts ?? default_options?.inserts ?? false,
              in_base_game_box: enrichedData.in_base_game_box ?? false,
              additional_images: enrichedData.additional_images ?? null,
            }).select("id, title").single();

            if (gameError || !newGame) { 
              failed++; 
              failureBreakdown.create_failed++;
              errors.push(`Failed to create "${enrichedData.title}": ${gameError?.message}`); 
              console.log(`[BulkImport] Failed to create game: ${enrichedData.title} - ${gameError?.message}`);
              continue; 
            }

            if (mechanicIds.length > 0) {
              await supabaseAdmin.from("game_mechanics").insert(mechanicIds.map(mid => ({ game_id: newGame.id, mechanic_id: mid })));
            }

            if (gameInput.purchase_date || gameInput.purchase_price) {
              await supabaseAdmin.from("game_admin_data").insert({ game_id: newGame.id, purchase_date: gameInput.purchase_date || null, purchase_price: gameInput.purchase_price || null });
            }

            imported++;
            importedGames.push({ title: newGame.title, id: newGame.id });
            await supabaseAdmin.from("import_jobs").update({ processed_items: i + 1, successful_items: imported, failed_items: failed }).eq("id", jobId);
            sendProgress({ type: "progress", current: i + 1, total: totalGames, imported, failed, currentGame: newGame.title, phase: "imported" });
          } catch (e) {
            console.error("[BulkImport] Game import exception:", e);
            failed++;
            failureBreakdown.exception++;
            errors.push(`Error importing "${gameInput.title}": ${e instanceof Error ? e.message : "Unknown error"}`);
            sendProgress({ type: "progress", current: i + 1, total: totalGames, imported, failed, currentGame: gameInput.title, phase: "error" });
          }
        }

        console.log("[BulkImport] Loop complete. Imported:", imported, "Failed:", failed, "Breakdown:", JSON.stringify(failureBreakdown));
        await supabaseAdmin.from("import_jobs").update({ status: "completed", processed_items: totalGames, successful_items: imported, failed_items: failed }).eq("id", jobId);
        sendProgress({ type: "complete", success: true, imported, failed, errors: errors.slice(0, 20), games: importedGames, failureBreakdown, debug: debugPayload });
        controller.close();
      },
    });

    return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });
  } catch (e) {
    console.error("[BulkImport] Top-level error:", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Bulk import failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

// ============================================================================
// INLINED: SIGNUP
// ============================================================================
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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
  // Never block API responses on SMTP.
  // We still attempt delivery in the background with a hard timeout.
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

  // denomailer behavior:
  // - `connection.tls: true`  => implicit TLS (typically 465)
  // - `connection.tls: false` => STARTTLS by default (typically 587)
  // For our internal Docker relay on port 25 we need *plain SMTP* (no TLS, no STARTTLS),
  // so we must set `debug.noStartTLS: true` and allow the unencrypted connection.
  const isPlainRelay = smtpPort === 25;

  const connection: any = {
    hostname: smtpHost,
    port: smtpPort,
    tls: smtpPort === 465,
  };

  if (requiresAuth) {
    connection.auth = { username: smtpUser, password: smtpPass };
  }

  const client = new SMTPClient({
    connection,
    ...(isPlainRelay
      ? {
          debug: {
            allowUnsecure: true,
            noStartTLS: true,
          },
        }
      : {}),
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
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #1a1510; font-family: Georgia, serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1510; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #2a2015; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #8B4513 0%, #654321 100%); padding: 30px; text-align: center;">
              <img src="https://ddfslywzgddlpmkhohfu.supabase.co/storage/v1/object/public/library-logos/platform-logo.png" alt="GameTaverns" style="max-height: 60px; width: auto; margin-bottom: 10px;" />
              <h1 style="color: #f5f0e6; margin: 0; font-size: 28px; font-weight: bold;">GameTaverns</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #f5f0e6; margin: 0 0 20px 0; font-size: 24px;">Welcome to GameTaverns!</h2>
              <p style="color: #c9bfb0; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Thanks for signing up! Please confirm your email address to activate your account.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td style="background: linear-gradient(135deg, #d97706 0%, #b45309 100%); border-radius: 6px;">
                    <a href="${params.confirmUrl}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 16px;">
                      Confirm Email
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #8b7355; font-size: 14px; line-height: 1.5; margin: 0;">
                This link will expire in 24 hours.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #1a1510; padding: 20px 30px; text-align: center; border-top: 1px solid #3d3425;">
              <p style="color: #6b5b4a; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} GameTaverns. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  });

  await client.close();
}

async function handleSignup(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, password, username, displayName, redirectUrl } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate username format if provided
    if (username) {
      if (username.length < 3 || username.length > 30) {
        return new Response(JSON.stringify({ error: "Username must be between 3 and 30 characters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return new Response(JSON.stringify({ error: "Username can only contain letters, numbers, and underscores" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if username is already taken
      const { data: existingUsername } = await supabase
        .from("user_profiles")
        .select("user_id")
        .eq("username", username.toLowerCase())
        .maybeSingle();

      if (existingUsername) {
        // If the profile row exists but the auth user does not (orphan), free the username.
        const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(
          existingUsername.user_id,
        );
        if (authUserError || !authUser?.user) {
          console.warn(
            `Orphaned username detected (${username.toLowerCase()}) for user_id=${existingUsername.user_id}. Deleting stale profile row.`,
          );
          await supabase.from("user_profiles").delete().eq("user_id", existingUsername.user_id);
        } else {
        return new Response(JSON.stringify({ error: "Username is already taken" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
        }
      }
    }

    // Create user via Admin API to avoid default confirmation email
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        display_name: displayName || email.split("@")[0],
        username: username?.toLowerCase(),
      },
    });

    if (createError) {
      const msg = String(createError.message || createError);
      const status = msg.toLowerCase().includes("already") ? 409 : 400;
      return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = created.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Failed to create user" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Best-effort profile row
    await supabase.from("user_profiles").upsert({
      user_id: userId,
      display_name: displayName || email.split("@")[0],
      username: username?.toLowerCase() || null,
    }, { onConflict: "user_id" });

    // Store token and send email
    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await supabase
      .from("email_confirmation_tokens")
      .delete()
      .eq("email", email.toLowerCase());

    const { error: tokenError } = await supabase
      .from("email_confirmation_tokens")
      .insert({
        user_id: userId,
        email: email.toLowerCase(),
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenError) {
      return new Response(JSON.stringify({ error: "Failed to create confirmation token" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = redirectUrl || "https://gametaverns.com";
    const confirmUrl = `${baseUrl}/verify-email?token=${token}`;
    // Fire-and-forget email sending so SMTP issues can't 504 the signup request
    console.log(
      `[Signup] Attempting confirmation email via SMTP ${Deno.env.get("SMTP_HOST")}:${Deno.env.get("SMTP_PORT") || "465"} for ${email}`,
    );

    sendEmailSafely(async () => {
      await sendConfirmationEmail({ email, confirmUrl });
      console.log(`[Signup] Confirmation email sent successfully to ${email}`);
    });

    return new Response(
      JSON.stringify({ success: true, message: "Account created. Check your email to confirm." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// ============================================================================
// GAME RECOMMENDATIONS HANDLER
// ============================================================================
async function handleGameRecommendations(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { game_id, library_id, limit = 5 } = await req.json();

    if (!game_id || !library_id) {
      return new Response(
        JSON.stringify({ error: "game_id and library_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiConfig = getAIConfig();
    if (!aiConfig) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the source game
    const { data: sourceGame, error: sourceError } = await supabase
      .from("games")
      .select(`id, title, description, difficulty, play_time, game_type, min_players, max_players, game_mechanics(mechanic:mechanics(name))`)
      .eq("id", game_id)
      .single();

    if (sourceError || !sourceGame) {
      return new Response(
        JSON.stringify({ error: "Game not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sourceMechanics = ((sourceGame as any).game_mechanics || [])
      .map((gm: any) => gm.mechanic?.name)
      .filter(Boolean);

    // Fetch all other games in the library
    const { data: libraryGames, error: libraryError } = await supabase
      .from("games")
      .select(`id, title, description, difficulty, play_time, game_type, min_players, max_players, slug, image_url, game_mechanics(mechanic:mechanics(name))`)
      .eq("library_id", library_id)
      .neq("id", game_id)
      .eq("is_expansion", false)
      .limit(100);

    if (libraryError) throw libraryError;

    if (!libraryGames || libraryGames.length === 0) {
      return new Response(
        JSON.stringify({ recommendations: [], message: "No other games in library" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const gamesForAI = libraryGames.map((g: any) => ({
      id: g.id, title: g.title, difficulty: g.difficulty, play_time: g.play_time, game_type: g.game_type,
      min_players: g.min_players, max_players: g.max_players,
      mechanics: (g.game_mechanics || []).map((gm: any) => gm.mechanic?.name).filter(Boolean),
    }));

    const systemPrompt = `You are a board game recommendation expert. Given a source game and a list of available games, recommend the most similar games based on:
- Game mechanics overlap
- Similar player counts
- Similar play time
- Similar difficulty/complexity
- Similar game type/category

Return ONLY a JSON array of game IDs, ordered by relevance (most similar first). Include a brief reason for each recommendation.`;

    const userPrompt = `Source game to find recommendations for:
Title: ${(sourceGame as any).title}
Type: ${(sourceGame as any).game_type || "Unknown"}
Difficulty: ${(sourceGame as any).difficulty || "Unknown"}
Play Time: ${(sourceGame as any).play_time || "Unknown"}
Players: ${(sourceGame as any).min_players || 1}-${(sourceGame as any).max_players || 4}
Mechanics: ${sourceMechanics.join(", ") || "None listed"}

Available games in the library:
${JSON.stringify(gamesForAI, null, 2)}

Return the top ${limit} most similar games as a JSON array with format:
[{"id": "game-uuid", "reason": "brief explanation"}]`;

    const aiResult = await aiComplete({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1000,
    });

    if (!aiResult.success) {
      if (aiResult.rateLimited) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(aiResult.error || "AI request failed");
    }

    let recommendations: { id: string; reason: string }[] = [];
    try {
      const jsonMatch = (aiResult.content || "").match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Fallback: return games sorted by mechanic overlap
      recommendations = gamesForAI
        .map((g: any) => ({ id: g.id, reason: "Similar game in your collection", score: g.mechanics.filter((m: string) => sourceMechanics.includes(m)).length }))
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, limit)
        .map(({ id, reason }: any) => ({ id, reason }));
    }

    const enrichedRecommendations = recommendations
      .map((rec) => {
        const game = libraryGames.find((g: any) => g.id === rec.id);
        if (!game) return null;
        return { id: (game as any).id, title: (game as any).title, slug: (game as any).slug, image_url: (game as any).image_url, difficulty: (game as any).difficulty, play_time: (game as any).play_time, min_players: (game as any).min_players, max_players: (game as any).max_players, reason: rec.reason || "Similar game" };
      })
      .filter(Boolean);

    return new Response(
      JSON.stringify({ recommendations: enrichedRecommendations }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Recommendations error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to get recommendations" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// RESOLVE USERNAME HANDLER
// ============================================================================
async function handleResolveUsername(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { username } = await req.json();
    if (!username) {
      return new Response(JSON.stringify({ error: "Username required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("user_id")
      .eq("username", username.toLowerCase())
      .maybeSingle();

    if (!profile?.user_id) {
      return new Response(JSON.stringify({ email: null }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData } = await supabase.auth.admin.getUserById(profile.user_id);

    return new Response(JSON.stringify({ email: userData?.user?.email || null }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Resolve username error:", error);
    return new Response(JSON.stringify({ email: null }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// ============================================================================
// SYNC ACHIEVEMENTS HANDLER
// ============================================================================
async function handleSyncAchievements(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Client with user's auth for getting their identity
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prefer owned library; if user is only a member, fall back to the first joined library.
    const { data: ownedLibrary } = await supabaseAdmin
      .from("libraries")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    let libraryId: string | null = ownedLibrary?.id ?? null;

    if (!libraryId) {
      const { data: membership } = await supabaseAdmin
        .from("library_members")
        .select("library_id")
        .eq("user_id", user.id)
        .maybeSingle();
      libraryId = membership?.library_id ?? null;
    }

    if (!libraryId) {
      return new Response(JSON.stringify({ error: "No library found", awarded: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate progress
    const { count: gamesCount } = await supabaseAdmin
      .from("games")
      .select("*", { count: "exact", head: true })
      .eq("library_id", libraryId)
      .eq("is_expansion", false);

    const { count: sessionsCount } = await supabaseAdmin
      .from("game_sessions")
      .select("*, games!inner(library_id)", { count: "exact", head: true })
      .eq("games.library_id", libraryId);

    const { count: loansCount } = await supabaseAdmin
      .from("game_loans")
      .select("*", { count: "exact", head: true })
      .eq("lender_user_id", user.id)
      .eq("status", "returned");

    // Followers/members gained (combine followers and members excluding the current user)
    const { count: followersCount } = await supabaseAdmin
      .from("library_followers")
      .select("*", { count: "exact", head: true })
      .eq("library_id", libraryId);

    const { count: membersCount } = await supabaseAdmin
      .from("library_members")
      .select("*", { count: "exact", head: true })
      .eq("library_id", libraryId)
      .neq("user_id", user.id);

    const { count: wishlistCount } = await supabaseAdmin
      .from("game_wishlist")
      .select("*, games!inner(library_id)", { count: "exact", head: true })
      .eq("games.library_id", libraryId);

    const { count: ratingsCount } = await supabaseAdmin
      .from("game_ratings")
      .select("*, games!inner(library_id)", { count: "exact", head: true })
      .eq("games.library_id", libraryId);

    const { data: gameTypes } = await supabaseAdmin
      .from("games")
      .select("game_type")
      .eq("library_id", libraryId)
      .eq("is_expansion", false)
      .not("game_type", "is", null);

    const uniqueTypes = new Set(gameTypes?.map((g) => g.game_type) || []);

    const progress = {
      games_owned: gamesCount || 0,
      sessions_logged: sessionsCount || 0,
      loans_completed: loansCount || 0,
      followers_gained: (followersCount || 0) + (membersCount || 0),
      wishlist_votes: wishlistCount || 0,
      ratings_given: ratingsCount || 0,
      unique_game_types: uniqueTypes.size,
    };

    const { data: achievements } = await supabaseAdmin
      .from("achievements")
      .select("id, requirement_type, requirement_value");

    const { data: earnedAchievements } = await supabaseAdmin
      .from("user_achievements")
      .select("achievement_id")
      .eq("user_id", user.id);

    const earnedIds = new Set(earnedAchievements?.map((a) => a.achievement_id) || []);

    const toAward: string[] = [];
    for (const achievement of achievements || []) {
      if (earnedIds.has(achievement.id)) continue;
      const currentValue = (progress as any)[achievement.requirement_type] || 0;
      if (currentValue >= achievement.requirement_value) {
        toAward.push(achievement.id);
      }
    }

    const awarded: string[] = [];
    for (const achievementId of toAward) {
      const requirementType = achievements?.find((a) => a.id === achievementId)?.requirement_type || "games_owned";
      const { error: insertError } = await supabaseAdmin
        .from("user_achievements")
        .insert({
          user_id: user.id,
          achievement_id: achievementId,
          progress: (progress as any)[requirementType] || 0,
          notified: false,
        });
      if (!insertError) awarded.push(achievementId);
    }

    let awardedNames: string[] = [];
    if (awarded.length > 0) {
      const { data: awardedAchievements } = await supabaseAdmin
        .from("achievements")
        .select("name")
        .in("id", awarded);
      awardedNames = awardedAchievements?.map((a) => a.name) || [];
    }

    return new Response(
      JSON.stringify({ success: true, progress, newAchievements: awarded.length, awarded: awardedNames }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error syncing achievements:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}

// ============================================================================
// DISCORD NOTIFY HANDLER
// ============================================================================
const DISCORD_COLORS = { game_added: 0x22c55e, wishlist_vote: 0xf59e0b, message_received: 0x3b82f6, poll_created: 0x8b5cf6, poll_closed: 0x6366f1 };

function buildDiscordEmbed(eventType: string, data: Record<string, unknown>): Record<string, unknown> {
  const embed: Record<string, unknown> = { color: DISCORD_COLORS[eventType as keyof typeof DISCORD_COLORS] || 0x6b7280, timestamp: new Date().toISOString() };

  switch (eventType) {
    case "game_added":
      embed.title = "🎲 New Game Added!";
      embed.description = `**${data.title}** has been added to the library.`;
      if (data.image_url) embed.thumbnail = { url: data.image_url };
      embed.fields = [];
      if (data.player_count) (embed.fields as any[]).push({ name: "Players", value: data.player_count, inline: true });
      if (data.play_time) (embed.fields as any[]).push({ name: "Play Time", value: data.play_time, inline: true });
      if (data.game_url) embed.url = data.game_url;
      break;
    case "wishlist_vote":
      embed.title = "❤️ Wishlist Vote";
      embed.description = `Someone wants to play **${data.game_title}**!`;
      if (data.image_url) embed.thumbnail = { url: data.image_url };
      embed.fields = [{ name: "Total Votes", value: String(data.vote_count || 1), inline: true }];
      if (data.voter_name) (embed.fields as any[]).push({ name: "Voter", value: data.voter_name, inline: true });
      break;
    case "message_received":
      embed.title = "💬 New Message";
      embed.description = `You received a message about **${data.game_title}**.`;
      if (data.sender_name) embed.fields = [{ name: "From", value: data.sender_name, inline: true }];
      embed.footer = { text: "Check your messages in the dashboard" };
      break;
    case "poll_created":
      embed.title = "🗳️ New Poll Created";
      embed.description = `**${data.poll_title}**`;
      embed.fields = [];
      if (data.game_count) (embed.fields as any[]).push({ name: "Games", value: `${data.game_count} options`, inline: true });
      if (data.poll_type) (embed.fields as any[]).push({ name: "Type", value: data.poll_type === "game_night" ? "Game Night" : "Quick Vote", inline: true });
      if (data.poll_url) { embed.url = data.poll_url; embed.footer = { text: "Click to vote!" }; }
      break;
    case "poll_closed":
      embed.title = "📊 Poll Results";
      embed.description = `**${data.poll_title}** has closed!`;
      embed.fields = [];
      if (data.winner_title) (embed.fields as any[]).push({ name: "🏆 Winner", value: data.winner_title, inline: false });
      if (data.total_votes) (embed.fields as any[]).push({ name: "Total Votes", value: String(data.total_votes), inline: true });
      break;
    default:
      embed.title = "📢 Notification";
      embed.description = JSON.stringify(data);
  }
  return embed;
}

async function handleDiscordNotify(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { library_id, event_type, data } = await req.json();
    if (!library_id || !event_type) {
      return new Response(JSON.stringify({ error: "Missing library_id or event_type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: library } = await supabase.from("libraries").select("owner_id").eq("id", library_id).maybeSingle();
    if (!library) {
      return new Response(JSON.stringify({ error: "Library not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: settings } = await supabase.from("library_settings").select("discord_webhook_url, discord_notifications").eq("library_id", library_id).maybeSingle();
    const notifications = (settings?.discord_notifications as Record<string, boolean>) || {};
    if (notifications[event_type] === false) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Notification type disabled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const embed = buildDiscordEmbed(event_type, data);
    const isPrivateEvent = event_type === "message_received";

    if (isPrivateEvent) {
      // Send DM to library owner via discord-send-dm (internal call)
      try {
        const dmResponse = await fetch(`${supabaseUrl}/functions/v1/discord-send-dm`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: library.owner_id, embed }),
        });
        if (!dmResponse.ok) console.error("DM send failed:", await dmResponse.text());
      } catch (e) { console.error("DM send error:", e); }
      return new Response(JSON.stringify({ success: true, method: "dm" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!settings?.discord_webhook_url) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "No webhook configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const discordResponse = await fetch(settings.discord_webhook_url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      return new Response(JSON.stringify({ error: "Failed to send Discord notification", details: errorText }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, method: "webhook" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Discord notify error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

// ============================================================================
// DISCORD CREATE EVENT HANDLER
// ============================================================================
const DISCORD_API = "https://discord.com/api/v10";

async function getGuildIdFromWebhook(webhookUrl: string): Promise<string | null> {
  try {
    const match = webhookUrl.match(/webhooks\/(\d+)\//);
    if (!match) return null;
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    if (!botToken) return null;
    const response = await fetch(`${DISCORD_API}/webhooks/${match[1]}`, { headers: { Authorization: `Bot ${botToken}` } });
    if (!response.ok) return null;
    const webhook = await response.json();
    return webhook.guild_id || null;
  } catch { return null; }
}

async function handleDiscordCreateEvent(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");

    const { library_id, poll_id, name, description, scheduled_start_time, scheduled_end_time, location, poll_url } = await req.json();

    if (!library_id || !poll_id || !name || !scheduled_start_time) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: settings } = await supabase.from("library_settings").select("discord_webhook_url, discord_notifications").eq("library_id", library_id).maybeSingle();
    if (!settings?.discord_webhook_url) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "No webhook configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const notifications = (settings.discord_notifications as Record<string, boolean>) || {};
    if (notifications.poll_created === false) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Poll notifications disabled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const guildId = await getGuildIdFromWebhook(settings.discord_webhook_url);
    if (!guildId) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Could not determine Discord server from webhook" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let eventDescription = description || "";
    if (poll_url) eventDescription += eventDescription ? `\n\n🗳️ Vote here: ${poll_url}` : `🗳️ Vote here: ${poll_url}`;

    const payload = {
      name, privacy_level: 2, scheduled_start_time,
      scheduled_end_time: scheduled_end_time || new Date(new Date(scheduled_start_time).getTime() + 3 * 60 * 60 * 1000).toISOString(),
      description: eventDescription || undefined, entity_type: 3,
      entity_metadata: { location: location || "Game Night Location TBD" },
    };

    const response = await fetch(`${DISCORD_API}/guilds/${guildId}/scheduled-events`, {
      method: "POST", headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ success: false, error: "Failed to create Discord event. Ensure bot has 'Manage Events' permission." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const discordEvent = await response.json();
    return new Response(JSON.stringify({ success: true, event_id: discordEvent.id, guild_id: guildId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Discord create-event error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

// ============================================================================
// DISCORD FORUM POST HANDLER
// ============================================================================
async function handleDiscordForumPost(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");

    const { library_id, title, description, event_date, event_location, poll_url, event_type, event_id } = await req.json();

    if (!library_id || !title) {
      return new Response(JSON.stringify({ error: "Missing required fields: library_id, title" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: settings } = await supabase.from("library_settings").select("discord_events_channel_id, discord_notifications").eq("library_id", library_id).maybeSingle();
    if (!settings?.discord_events_channel_id) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "No events forum channel configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const notifications = (settings.discord_notifications as Record<string, boolean>) || {};
    if (event_type === "poll" && notifications.poll_created === false) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Poll notifications disabled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const embed: Record<string, unknown> = { title, color: event_type === "poll" ? 0x8b5cf6 : 0x06b6d4, timestamp: new Date().toISOString() };
    let descText = description || "";
    if (poll_url) descText += descText ? `\n\n🗳️ **Vote here:** ${poll_url}` : `🗳️ **Vote here:** ${poll_url}`;
    if (descText) embed.description = descText;
    const fields: any[] = [];
    if (event_date) {
      const eventDate = new Date(event_date);
      fields.push({ name: "📅 Date & Time", value: eventDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }), inline: true });
    }
    if (event_location) fields.push({ name: "📍 Location", value: event_location, inline: true });
    if (fields.length > 0) embed.fields = fields;

    const payload = { name: title.substring(0, 100), message: { embeds: [embed] }, auto_archive_duration: 1440 };

    const response = await fetch(`${DISCORD_API}/channels/${settings.discord_events_channel_id}/threads`, {
      method: "POST", headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ success: false, error: `Discord API error: ${response.status} - ${errorText}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const thread = await response.json();

    if (event_type === "standalone" && event_id && thread.id) {
      await supabase.from("library_events").update({ discord_thread_id: thread.id }).eq("id", event_id);
    }

    return new Response(JSON.stringify({ success: true, thread_id: thread.id, event_id: event_id || null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Discord forum post error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

// ============================================================================
// DISCORD DELETE THREAD HANDLER
// ============================================================================
async function handleDiscordDeleteThread(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");

    const { library_id, thread_id } = await req.json();

    if (!library_id || !thread_id) {
      return new Response(JSON.stringify({ error: "Missing required fields: library_id, thread_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: library } = await supabase.from("libraries").select("id").eq("id", library_id).maybeSingle();
    if (!library) {
      return new Response(JSON.stringify({ error: "Library not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const response = await fetch(`${DISCORD_API}/channels/${thread_id}`, {
      method: "DELETE", headers: { Authorization: `Bot ${botToken}` },
    });

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ success: false, error: `Discord API error: ${response.status} - ${errorText}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Discord delete thread error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

// ============================================================================
// DISCORD OAUTH CALLBACK HANDLER
// ============================================================================
async function handleDiscordOAuthCallback(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    const appendQueryParam = (target: string, key: string, value: string) => {
      const joiner = target.includes("?") ? "&" : "?";
      return `${target}${joiner}${key}=${encodeURIComponent(value)}`;
    };

    const redirectWithError = (message: string, redirectTo: string | undefined): Response => {
      if (redirectTo) {
        const location = appendQueryParam(redirectTo, "discord_error", message);
        return new Response(null, { status: 302, headers: { Location: location } });
      }
      return new Response(`Discord connection failed: ${message}. Please close this tab and try again.`, {
        status: 400,
        headers: { "Content-Type": "text/plain" },
      });
    };

    if (error) return redirectWithError("Discord authorization was denied", undefined);
    if (!code || !state) return redirectWithError("Missing authorization code or state", undefined);

    const clientId = Deno.env.get("DISCORD_CLIENT_ID")!;
    const clientSecret = Deno.env.get("DISCORD_CLIENT_SECRET")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // CRITICAL: Discord requires the *exact* same redirect_uri on token exchange
    // as was used during the initial authorize step.
    // MUST use APP_URL first (same logic as discord-config handler) to ensure consistency.
    const appUrl = Deno.env.get("APP_URL");
    const xfHost = req.headers.get("x-forwarded-host");
    const xfProto = req.headers.get("x-forwarded-proto") || "https";
    
    const baseUrl =
      appUrl ||
      (xfHost ? `${xfProto}://${xfHost}` : null) ||
      supabaseUrl;
    const redirectUri = `${baseUrl.replace(/\/$/, "")}/functions/v1/discord-oauth-callback`;
    
    console.log("[discord-oauth-callback] Using redirect_uri:", redirectUri);

    let userId: string, appOrigin: string, returnUrl: string | undefined;
    try {
      const stateData = JSON.parse(atob(state));
      userId = stateData.user_id;
      appOrigin = stateData.app_origin;
      returnUrl = stateData.return_url;
      console.log("[discord-oauth-callback] Parsed state - userId:", userId, "appOrigin:", appOrigin, "returnUrl:", returnUrl);
    } catch (stateErr) {
      console.error("[discord-oauth-callback] Failed to parse state:", stateErr);
      return redirectWithError("Invalid state parameter", undefined);
    }

    const safeReturnUrl = typeof returnUrl === "string" && returnUrl.startsWith("/") ? returnUrl : "/dashboard";
    const redirectToBase = `${appOrigin}${safeReturnUrl}`;

    if (!userId || !appOrigin) {
      console.error("[discord-oauth-callback] Missing userId or appOrigin");
      return redirectWithError("Missing user ID or app origin in state", redirectToBase);
    }

    console.log("[discord-oauth-callback] Exchanging code for tokens...");
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenBody = await tokenResponse.text();
    console.log("[discord-oauth-callback] Token response status:", tokenResponse.status);
    
    if (!tokenResponse.ok) {
      console.error("[discord-oauth-callback] Token exchange failed:", tokenBody);
      return redirectWithError("Failed to exchange authorization code", redirectToBase);
    }

    const tokens = JSON.parse(tokenBody);
    console.log("[discord-oauth-callback] Got access token, fetching user info...");

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userResponse.ok) {
      const userBody = await userResponse.text();
      console.error("[discord-oauth-callback] User fetch failed:", userResponse.status, userBody);
      return redirectWithError("Failed to fetch Discord user info", redirectToBase);
    }

    const discordUser = await userResponse.json();
    console.log("[discord-oauth-callback] Got Discord user:", discordUser.id, discordUser.username);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    console.log("[discord-oauth-callback] Checking for existing profile...");
    const { data: existingProfile, error: profileFetchError } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileFetchError) {
      console.error("[discord-oauth-callback] Profile fetch error:", JSON.stringify(profileFetchError, null, 2));
    }

    let upsertError;
    if (existingProfile) {
      console.log("[discord-oauth-callback] Updating existing profile...");
      const { error } = await supabase
        .from("user_profiles")
        .update({ discord_user_id: discordUser.id })
        .eq("user_id", userId);
      upsertError = error;
    } else {
      console.log("[discord-oauth-callback] Inserting new profile...");
      const { error } = await supabase
        .from("user_profiles")
        .insert({ user_id: userId, discord_user_id: discordUser.id });
      upsertError = error;
    }

    if (upsertError) {
      console.error("[discord-oauth-callback] Upsert error:", JSON.stringify(upsertError, null, 2));
      const anyErr = upsertError as any;
      return redirectWithError(anyErr?.message || "Failed to link Discord account", redirectToBase);
    }

    console.log("[discord-oauth-callback] Success! Redirecting back to:", redirectToBase);
    return new Response(null, {
      status: 302,
      headers: { Location: appendQueryParam(redirectToBase, "discord_linked", "true") },
    });
  } catch (error) {
    console.error("[discord-oauth-callback] Unexpected error:", error);
    return new Response(`Discord connection failed: ${(error as Error).message}. Please close this tab and try again.`, { status: 400, headers: { "Content-Type": "text/plain" } });
  }
}

// ============================================================================
// DISCORD SEND DM HANDLER
// ============================================================================
async function handleDiscordSendDM(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { user_id, embed } = await req.json();
    if (!user_id || !embed) {
      return new Response(JSON.stringify({ error: "Missing user_id or embed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await supabase.from("user_profiles").select("discord_user_id").eq("user_id", user_id).maybeSingle();

    if (!profile?.discord_user_id) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "No Discord account linked" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const channelResponse = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bot ${botToken}` },
      body: JSON.stringify({ recipient_id: profile.discord_user_id }),
    });

    if (!channelResponse.ok) {
      if (channelResponse.status === 403) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "User has DMs disabled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Failed to create DM channel" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const channel = await channelResponse.json();

    const messageResponse = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bot ${botToken}` },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!messageResponse.ok) {
      try {
        const parsed = await messageResponse.json();
        if (parsed?.code === 50007) {
          return new Response(JSON.stringify({ success: true, skipped: true, reason: "Cannot send messages to this user (Discord code 50007)" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch {}
      return new Response(JSON.stringify({ error: "Failed to send DM" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Discord DM error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

// ============================================================================
// MAIN ROUTER
// ============================================================================
const AVAILABLE_FUNCTIONS = [
  "bgg-import", "bgg-lookup", "bulk-import", "condense-descriptions", "decrypt-messages",
  "discord-config", "discord-create-event", "discord-delete-thread", "discord-forum-post",
  "discord-notify", "discord-oauth-callback", "discord-send-dm", "discord-unlink",
  "game-import", "game-recommendations", "image-proxy", "manage-account", "manage-users",
  "my-inquiries", "rate-game", "refresh-images", "reply-to-inquiry", "resolve-username", "send-auth-email",
  "send-message", "signup", "sync-achievements", "totp-disable", "totp-setup", "totp-status",
  "totp-verify", "verify-email", "verify-reset-token", "wishlist",
  // Self-hosted-only helpers
  "membership", "library-settings",
];

const INLINED_FUNCTIONS = [
  "totp-status", "totp-setup", "totp-verify", "totp-disable", "manage-users", "manage-account",
  "wishlist", "rate-game", "discord-config", "discord-unlink", "image-proxy", "bulk-import", "refresh-images",
  "signup", "game-recommendations", "verify-email", "verify-reset-token", "send-auth-email",
  "send-message", "my-inquiries", "reply-to-inquiry", "condense-descriptions", "decrypt-messages", "resolve-username", "sync-achievements",
  "discord-notify", "discord-create-event", "discord-forum-post", "discord-delete-thread",
  "discord-oauth-callback", "discord-send-dm",
  // Self-hosted-only helpers
  "membership", "library-settings", "profile-update",
];

// NOTE: In self-hosted deployments, the edge-runtime process itself binds to the
// container port (e.g. 9000) and forwards requests into this handler.
// We should NOT try to bind our own listener port here.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Extract function name from URL path
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);

  // Compatibility: older clients call /functions/v1/main/<function>
  // Kong strips /functions/v1, so we receive /main/<function> here.
  // In that case, we should dispatch to <function>.
  const functionName = pathParts[0] === "main" ? pathParts[1] : pathParts[0];

  // Route inlined functions
  switch (functionName) {
    case "bgg-import":
      return bggImportHandler(req);
    case "bgg-lookup":
      return bggLookupHandler(req);
    case "game-import":
      return gameImportHandler(req);
    case "totp-status":
      return handleTotpStatus(req);
    case "totp-setup":
      return handleTotpSetup(req);
    case "totp-verify":
      return handleTotpVerify(req);
    case "totp-disable":
      return handleTotpDisable(req);
    case "manage-users":
      return handleManageUsers(req);
    case "wishlist":
      return handleWishlist(req);
    case "rate-game":
      return handleRateGame(req);
    case "discord-config":
      return handleDiscordConfig(req);
    case "discord-unlink":
      return handleDiscordUnlink(req);
    case "image-proxy":
      return handleImageProxy(req);
    case "manage-account":
      return handleManageAccount(req);
    case "bulk-import":
      return handleBulkImport(req);
    case "refresh-images":
      return handleRefreshImages(req);
    case "signup":
      return handleSignup(req);
    // Imported handlers
    case "verify-email":
      return verifyEmailHandler(req);
    case "verify-reset-token":
      return verifyResetTokenHandler(req);
    case "send-auth-email":
      return sendAuthEmailHandler(req);
    case "send-message":
      return sendMessageHandler(req);
    case "my-inquiries":
      return myInquiriesHandler(req);
    case "reply-to-inquiry":
      return replyToInquiryHandler(req);
    case "condense-descriptions":
      return condenseDescriptionsHandler(req);
    case "decrypt-messages":
      return decryptMessagesHandler(req);
    case "membership":
      return membershipHandler(req);
    case "library-settings":
      return librarySettingsHandler(req);
    case "profile-update":
      return profileUpdateHandler(req);
    // Inlined handlers for remaining functions
    case "game-recommendations":
      return handleGameRecommendations(req);
    case "resolve-username":
      return handleResolveUsername(req);
    case "sync-achievements":
      return handleSyncAchievements(req);
    case "discord-notify":
      return handleDiscordNotify(req);
    case "discord-create-event":
      return handleDiscordCreateEvent(req);
    case "discord-forum-post":
      return handleDiscordForumPost(req);
    case "discord-delete-thread":
      return handleDiscordDeleteThread(req);
    case "discord-oauth-callback":
      return handleDiscordOAuthCallback(req);
    case "discord-send-dm":
      return handleDiscordSendDM(req);
  }

  // For other functions, return info
  if (!functionName || functionName === "main") {
    return new Response(
      JSON.stringify({
        message: "Edge function router (self-hosted)",
        note: "Some functions are inlined for self-hosted. Others require Lovable Cloud or must be added to this router.",
        inlined: INLINED_FUNCTIONS,
        available: AVAILABLE_FUNCTIONS,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Function exists but not inlined
  if (AVAILABLE_FUNCTIONS.includes(functionName)) {
    return new Response(
      JSON.stringify({
        error: "Function not inlined in self-hosted router",
        function: functionName,
        hint: "This function works in Lovable Cloud. For self-hosted, it needs to be added to main/index.ts",
      }),
      { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ error: "Function not found", function: functionName }),
    { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
