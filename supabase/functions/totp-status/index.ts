import { createClient } from "npm:@supabase/supabase-js@2";
import { withLogging } from "../_shared/system-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Decode a JWT and return the payload without verifying the signature.
 * Signature verification is handled by the Supabase client / Kong gateway.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

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

    const token = authHeader.replace("Bearer ", "");

    // Decode the JWT locally to extract user ID — no network call required.
    // This is more reliable in self-hosted environments than getClaims() or getUser().
    const payload = decodeJwtPayload(token);
    const userId = payload?.sub as string | undefined;

    if (!userId) {
      console.error("[totp-status] Could not extract user ID from JWT");
      return new Response(
        JSON.stringify({ error: "Invalid token — could not extract user ID" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: totpSettings, error: fetchError } = await adminClient
      .from("user_totp_settings")
      .select("is_enabled, verified_at, backup_codes_encrypted, last_login_totp_verified_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      console.error("[totp-status] Fetch error:", fetchError);
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
      } catch {}
    }

    const GRACE_PERIOD_MINUTES = 120;
    let requiresVerification = true;

    if (totpSettings?.is_enabled && totpSettings?.last_login_totp_verified_at) {
      const lastVerified = new Date(totpSettings.last_login_totp_verified_at);
      const now = new Date();
      const minutesSinceVerification = (now.getTime() - lastVerified.getTime()) / (1000 * 60);

      if (minutesSinceVerification < GRACE_PERIOD_MINUTES) {
        requiresVerification = false;
      }
    }

    console.log("[totp-status] User:", userId, "isEnabled:", totpSettings?.is_enabled ?? false, "requiresVerification:", requiresVerification);

    return new Response(
      JSON.stringify({
        isEnabled: totpSettings?.is_enabled ?? false,
        verifiedAt: totpSettings?.verified_at ?? null,
        remainingBackupCodes,
        requiresSetup: !totpSettings?.is_enabled,
        requiresVerification,
        lastLoginVerifiedAt: totpSettings?.last_login_totp_verified_at ?? null,
        gracePeriodMinutes: GRACE_PERIOD_MINUTES,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[totp-status] Unhandled error:", error);
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
