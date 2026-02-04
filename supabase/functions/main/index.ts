// Main router for self-hosted deployments
// Since edge-runtime can only serve ONE main service directory,
// all functions must be inlined here for self-hosted multi-function support.
// For Lovable Cloud, each function is deployed independently.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as OTPAuth from "https://esm.sh/otpauth@9.4.0";

// Self-hosted router delegates many functions to their regular implementations.
// These modules must guard `Deno.serve(...)` behind `import.meta.main`.
import bggImportHandler from "../bgg-import/index.ts";
import bggLookupHandler from "../bgg-lookup/index.ts";
import gameImportHandler from "../game-import/index.ts";

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

    const { game_id, rating, guest_identifier, device_fingerprint } = await req.json();

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

    const { error } = await supabase
      .from("game_ratings")
      .upsert(
        {
          game_id,
          rating,
          guest_identifier,
          device_fingerprint: device_fingerprint || null,
          ip_address: clientIp,
        },
        { onConflict: "game_id,guest_identifier" }
      );

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true }),
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
async function handleDiscordConfig(_req: Request): Promise<Response> {
  try {
    const clientId = Deno.env.get("DISCORD_CLIENT_ID");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "Discord integration not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        client_id: clientId,
        redirect_uri: `${supabaseUrl}/functions/v1/discord-oauth-callback`,
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
async function handleImageProxy(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const imageUrl = url.searchParams.get("url");

  if (!imageUrl) {
    return new Response("Missing 'url' parameter", { status: 400, headers: corsHeaders });
  }

  try {
    const decodedUrl = decodeURIComponent(imageUrl);
    
    // Security: Only allow specific domains
    const allowedDomains = [
      "cf.geekdo-images.com",
      "images.unsplash.com",
    ];

    const urlObj = new URL(decodedUrl);
    if (!allowedDomains.some(d => urlObj.hostname.endsWith(d))) {
      return new Response("Domain not allowed", { status: 403, headers: corsHeaders });
    }

    const response = await fetch(decodedUrl, {
      headers: { "User-Agent": "GameTaverns/1.0" },
    });

    if (!response.ok) {
      return new Response("Failed to fetch image", { status: response.status, headers: corsHeaders });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const imageData = await response.arrayBuffer();

    return new Response(imageData, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
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
// BULK-IMPORT HANDLER (Inlined for self-hosted)
// ============================================================================
const DIFFICULTY_LEVELS = ["1 - Light", "2 - Medium Light", "3 - Medium", "4 - Medium Heavy", "5 - Heavy"];
const PLAY_TIME_OPTIONS = ["0-15 Minutes", "15-30 Minutes", "30-45 Minutes", "45-60 Minutes", "60+ Minutes", "2+ Hours", "3+ Hours"];
const GAME_TYPE_OPTIONS = ["Board Game", "Card Game", "Dice Game", "Party Game", "War Game", "Miniatures", "RPG", "Other"];

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
  if (w < 1.5) return "1 - Light";
  if (w < 2.25) return "2 - Medium Light";
  if (w < 3.0) return "3 - Medium";
  if (w < 3.75) return "4 - Medium Heavy";
  return "5 - Heavy";
};

const mapPlayTimeToEnum = (minutes: number | undefined): string | undefined => {
  if (!minutes) return undefined;
  if (minutes <= 15) return "0-15 Minutes";
  if (minutes <= 30) return "15-30 Minutes";
  if (minutes <= 45) return "30-45 Minutes";
  if (minutes <= 60) return "45-60 Minutes";
  if (minutes <= 120) return "60+ Minutes";
  if (minutes <= 180) return "2+ Hours";
  return "3+ Hours";
};

const buildDescription = (description: string | undefined, privateComment: string | undefined): string | undefined => {
  const desc = description?.trim();
  const notes = privateComment?.trim();
  if (!desc && !notes) return undefined;
  if (!notes) return desc;
  if (!desc) return `**Notes:** ${notes}`;
  return `${desc}\n\n**Notes:** ${notes}`;
};

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

    const { mode, library_id, csv_data, default_options } = body;
    console.log("[BulkImport] Mode:", mode, "library_id:", library_id, "csv_data length:", csv_data?.length);
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
            type: row.type || row["game type"] || undefined,
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
            image_url: row.image_url || row["image url"] || row.thumbnail || undefined,
            purchase_date: parseDate(row.acquisitiondate || row.acquisition_date || row.purchase_date),
            purchase_price: parsePrice(row.pricepaid || row.price_paid || row.purchase_price),
          });
        }
      }
      console.log("[BulkImport] Games to import:", gamesToImport.length);
    } else {
      console.log("[BulkImport] FAIL: Not CSV mode or no csv_data. mode=", mode, "csv_data present:", !!csv_data);
      return new Response(JSON.stringify({ success: false, error: "Only CSV mode is supported in self-hosted" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const totalGames = gamesToImport.length;
    const { data: job, error: jobError } = await supabaseAdmin.from("import_jobs").insert({ library_id: targetLibraryId, status: "processing", total_items: totalGames, processed_items: 0, successful_items: 0, failed_items: 0 }).select("id").single();
    if (jobError || !job) {
      return new Response(JSON.stringify({ success: false, error: "Failed to create import job" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const jobId = job.id;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendProgress = (data: Record<string, unknown>) => { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); };
        let imported = 0;
        let failed = 0;
        const errors: string[] = [];
        const importedGames: { title: string; id?: string }[] = [];
        sendProgress({ type: "start", jobId, total: totalGames });

        for (let i = 0; i < gamesToImport.length; i++) {
          const gameInput = gamesToImport[i];
          try {
            sendProgress({ type: "progress", current: i + 1, total: totalGames, imported, failed, currentGame: gameInput.title, phase: "importing" });
            if (!gameInput.title) { failed++; errors.push(`Could not determine title for game`); continue; }

            const { data: existing } = await supabaseAdmin.from("games").select("id, title").eq("title", gameInput.title).eq("library_id", targetLibraryId).maybeSingle();
            if (existing) { failed++; errors.push(`"${gameInput.title}" already exists`); continue; }

            const mechanicIds: string[] = [];
            if (gameInput.mechanics?.length) {
              for (const name of gameInput.mechanics) {
                const { data: em } = await supabaseAdmin.from("mechanics").select("id").eq("name", name).maybeSingle();
                if (em) { mechanicIds.push(em.id); }
                else {
                  const { data: nm } = await supabaseAdmin.from("mechanics").insert({ name }).select("id").single();
                  if (nm) mechanicIds.push(nm.id);
                }
              }
            }

            let publisherId: string | null = null;
            if (gameInput.publisher) {
              const { data: ep } = await supabaseAdmin.from("publishers").select("id").eq("name", gameInput.publisher).maybeSingle();
              if (ep) { publisherId = ep.id; }
              else {
                const { data: np } = await supabaseAdmin.from("publishers").insert({ name: gameInput.publisher }).select("id").single();
                if (np) publisherId = np.id;
              }
            }

            let parentGameId: string | null = null;
            if (gameInput.is_expansion && gameInput.parent_game) {
              const { data: pg } = await supabaseAdmin.from("games").select("id").eq("title", gameInput.parent_game).eq("library_id", targetLibraryId).maybeSingle();
              if (pg) { parentGameId = pg.id; }
            }

            const { data: newGame, error: gameError } = await supabaseAdmin.from("games").insert({
              library_id: targetLibraryId,
              title: gameInput.title,
              description: gameInput.description || null,
              image_url: gameInput.image_url || null,
              bgg_id: gameInput.bgg_id || null,
              bgg_url: gameInput.bgg_url || null,
              min_players: gameInput.min_players ?? 2,
              max_players: gameInput.max_players ?? 4,
              suggested_age: gameInput.suggested_age || null,
              play_time: gameInput.play_time || "45-60 Minutes",
              difficulty: gameInput.difficulty || "3 - Medium",
              game_type: gameInput.type || "Board Game",
              publisher_id: publisherId,
              is_expansion: gameInput.is_expansion ?? false,
              parent_game_id: parentGameId,
              is_coming_soon: gameInput.is_coming_soon ?? default_options?.is_coming_soon ?? false,
              is_for_sale: gameInput.is_for_sale ?? default_options?.is_for_sale ?? false,
              sale_price: gameInput.sale_price ?? default_options?.sale_price ?? null,
              sale_condition: gameInput.sale_condition ?? default_options?.sale_condition ?? null,
              location_room: gameInput.location_room ?? default_options?.location_room ?? null,
              location_shelf: gameInput.location_shelf ?? default_options?.location_shelf ?? null,
              location_misc: gameInput.location_misc ?? default_options?.location_misc ?? null,
              sleeved: gameInput.sleeved ?? default_options?.sleeved ?? false,
              upgraded_components: gameInput.upgraded_components ?? default_options?.upgraded_components ?? false,
              crowdfunded: gameInput.crowdfunded ?? default_options?.crowdfunded ?? false,
              inserts: gameInput.inserts ?? default_options?.inserts ?? false,
              in_base_game_box: gameInput.in_base_game_box ?? false,
            }).select("id, title").single();

            if (gameError || !newGame) { failed++; errors.push(`Failed to create "${gameInput.title}": ${gameError?.message}`); continue; }

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
            console.error("Game import error:", e);
            failed++;
            errors.push(`Error importing "${gameInput.title}": ${e instanceof Error ? e.message : "Unknown error"}`);
            sendProgress({ type: "progress", current: i + 1, total: totalGames, imported, failed, currentGame: gameInput.title, phase: "error" });
          }
        }

        await supabaseAdmin.from("import_jobs").update({ status: "completed", processed_items: totalGames, successful_items: imported, failed_items: failed }).eq("id", jobId);
        sendProgress({ type: "complete", success: true, imported, failed, errors: errors.slice(0, 20), games: importedGames });
        controller.close();
      },
    });

    return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });
  } catch (e) {
    console.error("Bulk import error:", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Bulk import failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
  "rate-game", "refresh-images", "resolve-username", "send-auth-email", "send-email",
  "send-message", "signup", "sync-achievements", "totp-disable", "totp-setup", "totp-status",
  "totp-verify", "verify-email", "verify-reset-token", "wishlist",
];

const INLINED_FUNCTIONS = [
  "totp-status", "totp-setup", "totp-verify", "totp-disable", "manage-users", "manage-account",
  "wishlist", "rate-game", "discord-config", "discord-unlink", "image-proxy", "bulk-import",
];

// IMPORTANT (self-hosted): edge-runtime may run this service on a non-default port.
// If we don't bind to the provided PORT, Docker healthchecks (hitting :9000) will fail
// and the container will be repeatedly SIGTERM'd/restarted.
const PORT = Number(Deno.env.get("PORT") || 9000);
console.log(`[MainRouter] Starting on port ${PORT}`);

Deno.serve({ port: PORT }, async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Extract function name from URL path
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const functionName = pathParts[0];

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
