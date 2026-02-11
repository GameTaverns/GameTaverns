import { createClient } from "npm:@supabase/supabase-js@2";
import * as OTPAuth from "npm:otpauth@9.4.0";
import { withLogging } from "../_shared/system-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

        if (action === "login") {
          await adminClient
            .from("user_totp_settings")
            .update({ last_login_totp_verified_at: new Date().toISOString() })
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

    if (action === "login") {
      await adminClient
        .from("user_totp_settings")
        .update({ last_login_totp_verified_at: new Date().toISOString() })
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
};

export default handler;

if (import.meta.main) {
  Deno.serve(handler);
}
