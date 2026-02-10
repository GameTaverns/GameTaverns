// Main router for self-hosted deployments
// Since edge-runtime can only serve ONE main service directory,
// all functions must be inlined here for self-hosted multi-function support.
// For Lovable Cloud, each function is deployed independently.

import { createClient } from "npm:@supabase/supabase-js@2";
import * as OTPAuth from "npm:otpauth@9.4.0";

// Self-hosted router delegates many functions to their regular implementations.
// These modules must guard `Deno.serve(...)` behind `import.meta.main`.
import bggImportHandler, { setGameImportHandler } from "../bgg-import/index.ts";
import clubsHandler from "../clubs/index.ts";
import bggLookupHandler from "../bgg-lookup/index.ts";
import bggPlayImportHandler from "../bgg-play-import/index.ts";
import bggSyncHandler from "../bgg-sync/index.ts";
import bggSyncCronHandler from "../bgg-sync-cron/index.ts";
import gameImportHandler from "../game-import/index.ts";
import bulkImportHandler from "../bulk-import/index.ts";

// Wire bgg-import to call game-import directly (avoids HTTP proxy deadlock)
setGameImportHandler(gameImportHandler);

// Router-compatible exported handlers
import verifyEmailHandler from "../verify-email/index.ts";
import verifyResetTokenHandler from "../verify-reset-token/index.ts";
import sendAuthEmailHandler from "../send-auth-email/index.ts";
import sendMessageHandler from "../send-message/index.ts";
import myInquiriesHandler from "../my-inquiries/index.ts";
import replyToInquiryHandler from "../reply-to-inquiry/index.ts";
import sendInquiryReplyHandler from "../send-inquiry-reply/index.ts";
import condenseDescriptionsHandler from "../condense-descriptions/index.ts";
import decryptMessagesHandler from "../decrypt-messages/index.ts";
import membershipHandler from "../membership/index.ts";
import librarySettingsHandler from "../library-settings/index.ts";
import profileUpdateHandler from "../profile-update/index.ts";
import notifyFeedbackHandler from "../notify-feedback/index.ts";

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

    // === Community/Forum Metrics ===
    
    // Threads created by user
    const { count: threadsCount } = await supabaseAdmin
      .from("forum_threads")
      .select("*", { count: "exact", head: true })
      .eq("author_id", user.id);

    // Replies created by user
    const { count: repliesCount } = await supabaseAdmin
      .from("forum_replies")
      .select("*", { count: "exact", head: true })
      .eq("author_id", user.id);

    // Total replies received on all threads by user
    const { data: userThreadReplies } = await supabaseAdmin
      .from("forum_threads")
      .select("reply_count")
      .eq("author_id", user.id);
    const threadRepliesReceived = (userThreadReplies || []).reduce(
      (sum, t) => sum + (t.reply_count || 0), 0
    );

    // Libraries joined (as member)
    const { count: librariesJoined } = await supabaseAdmin
      .from("library_members")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    // Unique library forums user has posted in (avoid nested joins for self-hosted)
    const { data: threadCategories } = await supabaseAdmin
      .from("forum_threads")
      .select("category_id")
      .eq("author_id", user.id);
    const { data: replyThreads } = await supabaseAdmin
      .from("forum_replies")
      .select("thread_id")
      .eq("author_id", user.id);
    
    const categoryIds = new Set<string>();
    threadCategories?.forEach((t) => categoryIds.add(t.category_id));
    
    // Get thread category_ids for replies
    if (replyThreads && replyThreads.length > 0) {
      const threadIds = replyThreads.map((r) => r.thread_id);
      const { data: replyThreadCategories } = await supabaseAdmin
        .from("forum_threads")
        .select("category_id")
        .in("id", threadIds);
      replyThreadCategories?.forEach((t) => categoryIds.add(t.category_id));
    }

    // Get library_ids from categories
    let libraryForumsActive = 0;
    if (categoryIds.size > 0) {
      const { data: categoriesWithLibraries } = await supabaseAdmin
        .from("forum_categories")
        .select("library_id")
        .in("id", Array.from(categoryIds))
        .not("library_id", "is", null);
      const libraryForumsSet = new Set<string>();
      categoriesWithLibraries?.forEach((c) => {
        if (c.library_id) libraryForumsSet.add(c.library_id);
      });
      libraryForumsActive = libraryForumsSet.size;
    }

    const progress = {
      games_owned: gamesCount || 0,
      sessions_logged: sessionsCount || 0,
      loans_completed: loansCount || 0,
      followers_gained: (followersCount || 0) + (membersCount || 0),
      wishlist_votes: wishlistCount || 0,
      ratings_given: ratingsCount || 0,
      unique_game_types: uniqueTypes.size,
      // Forum metrics
      threads_created: threadsCount || 0,
      replies_created: repliesCount || 0,
      thread_replies_received: threadRepliesReceived,
      libraries_joined: librariesJoined || 0,
      library_forums_active: libraryForumsActive,
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
const DISCORD_COLORS = { game_added: 0x22c55e, wishlist_vote: 0xf59e0b, message_received: 0x3b82f6, poll_created: 0x8b5cf6, poll_closed: 0x6366f1, loan_requested: 0xec4899 };

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
    case "loan_requested":
      embed.title = "📚 New Loan Request";
      embed.description = `Someone wants to borrow **${data.game_title}**!`;
      if (data.image_url) embed.thumbnail = { url: data.image_url };
      embed.fields = [];
      if (data.borrower_name) (embed.fields as any[]).push({ name: "From", value: data.borrower_name, inline: true });
      if (data.notes) (embed.fields as any[]).push({ name: "Note", value: data.notes, inline: false });
      embed.footer = { text: "Check your Lending Dashboard to approve or decline" };
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

    const payload = await req.json();
    const { library_id, lender_user_id, event_type, data } = payload;
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
    const isPrivateEvent = event_type === "message_received" || event_type === "loan_requested";

    if (isPrivateEvent) {
      // For loan_requested, use lender_user_id if provided; otherwise fall back to library owner
      const targetUserId = lender_user_id || library.owner_id;
      // Send DM to target user via discord-send-dm (internal call)
      try {
        const dmResponse = await fetch(`${supabaseUrl}/functions/v1/discord-send-dm`, {
          method: "POST", 
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ user_id: targetUserId, embed }),
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
  "bgg-import", "bgg-lookup", "bgg-play-import", "bulk-import", "condense-descriptions", "decrypt-messages",
  "discord-config", "discord-create-event", "discord-delete-thread", "discord-forum-post",
  "discord-notify", "discord-oauth-callback", "discord-send-dm", "discord-unlink",
  "game-import", "game-recommendations", "image-proxy", "manage-account", "manage-users",
  "my-inquiries", "rate-game", "refresh-images", "reply-to-inquiry", "resolve-username", "send-auth-email",
  "send-inquiry-reply", "send-message", "signup", "sync-achievements", "totp-disable", "totp-setup", "totp-status",
  "totp-verify", "verify-email", "verify-reset-token", "wishlist",
  "notify-feedback", "clubs",
  // Self-hosted-only helpers
  "membership", "library-settings",
];

const INLINED_FUNCTIONS = [
  "totp-status", "totp-setup", "totp-verify", "totp-disable", "manage-users", "manage-account",
  "wishlist", "rate-game", "discord-config", "discord-unlink", "image-proxy", "refresh-images",
  "signup", "game-recommendations", "verify-email", "verify-reset-token", "send-auth-email",
  "send-inquiry-reply", "send-message", "my-inquiries", "reply-to-inquiry", "condense-descriptions", "decrypt-messages", "resolve-username", "sync-achievements",
  "discord-notify", "discord-create-event", "discord-forum-post", "discord-delete-thread",
  "discord-oauth-callback", "discord-send-dm",
  // Self-hosted-only helpers
  "membership", "library-settings", "profile-update",
  // Self-hosted-only feature functions
  "bgg-play-import",
    "notify-feedback", "clubs",
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
    case "bgg-play-import":
      return bggPlayImportHandler(req);
    case "bgg-sync":
      return bggSyncHandler(req);
    case "bgg-sync-cron":
      return bggSyncCronHandler(req);
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
      return bulkImportHandler(req);
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
    case "send-inquiry-reply":
      return sendInquiryReplyHandler(req);
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
    case "notify-feedback":
      return notifyFeedbackHandler(req);
    case "clubs":
      return clubsHandler(req);
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
