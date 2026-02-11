import { createClient } from "npm:@supabase/supabase-js@2";

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

    const { data: totpSettings, error: fetchError } = await adminClient
      .from("user_totp_settings")
      .select("is_enabled, verified_at, backup_codes_encrypted, last_login_totp_verified_at")
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
    console.error("TOTP status error:", error);
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
