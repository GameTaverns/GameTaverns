import { createClient } from "npm:@supabase/supabase-js@2";
import * as OTPAuth from "npm:otpauth@9.4.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
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

    // Verify the user's token
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

    // Use service role for database operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { action } = await req.json();

    if (action === "generate") {
      // Generate a new TOTP secret
      const secret = new OTPAuth.Secret({ size: 20 });
      
      // Get user email for the TOTP label
      const issuer = "GameTaverns";
      const label = user.email || user.id;
      
      // Create TOTP instance
      const totp = new OTPAuth.TOTP({
        issuer,
        label,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret,
      });

      // Generate QR code URI
      const otpauthUri = totp.toString();
      
      // Generate backup codes (8 codes, 8 characters each)
      const backupCodes: string[] = [];
      for (let i = 0; i < 8; i++) {
        const code = crypto.getRandomValues(new Uint8Array(4));
        backupCodes.push(Array.from(code).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase());
      }

      // Store the secret (encrypted) and backup codes - not enabled yet
      // Hash backup codes before storage
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

      // Upsert the TOTP settings (not enabled until verified)
      const { error: upsertError } = await adminClient
        .from("user_totp_settings")
        .upsert({
          user_id: user.id,
          totp_secret_encrypted: secret.base32, // In production, encrypt this with a server key
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
          backupCodes, // Only shown once during setup
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
});
