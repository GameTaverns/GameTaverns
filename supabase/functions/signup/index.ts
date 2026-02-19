import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { withLogging } from "../_shared/system-logger.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SignupRequest {
  email: string;
  password: string;
  username?: string;
  displayName?: string;
  redirectUrl?: string;
  referralCode?: string;
}

const SMTP_SEND_TIMEOUT_MS = 8000;

function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

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

async function sendEmailSafely(sendFn: () => Promise<void>, email: string) {
  // Must await SMTP delivery — the self-hosted edge runtime terminates the
  // isolate immediately after the handler returns, so fire-and-forget fails.
  try {
    await withTimeout(sendFn(), SMTP_SEND_TIMEOUT_MS, "SMTP send");
    console.log(`[Signup] Email successfully sent to ${email}`);
  } catch (e: any) {
    console.error(`[Signup] SMTP send FAILED for ${email}:`, e?.message || e);
    if (e?.stack) {
      console.error(`[Signup] Stack trace:`, e.stack);
    }
    // Don't re-throw — still return success to prevent email enumeration
  }
}

function getSmtpClient() {
  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
  const smtpUser = Deno.env.get("SMTP_USER") || "";
  const smtpPass = Deno.env.get("SMTP_PASS") || "";
  const smtpFrom = Deno.env.get("SMTP_FROM");

  // Always authenticate if credentials are provided — Mailcow rejects
  // unauthenticated relay even on port 25 for sender verification.
  const requiresAuth = !!(smtpUser && smtpPass);

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
  const useImplicitTls = smtpPort === 465;

  const connection: any = {
    hostname: smtpHost,
    port: smtpPort,
    tls: useImplicitTls,
  };

  // Port 25 on the internal Docker relay does not support AUTH
  if (requiresAuth && smtpPort !== 25) {
    connection.auth = { username: smtpUser, password: smtpPass };
  }

  // For non-implicit-TLS ports (25, 587) on the internal Docker network,
  // skip STARTTLS — the cert is issued for the public hostname, not the
  // container name, so the TLS handshake will always fail.
  const client = new SMTPClient({
    connection,
    ...(!useImplicitTls
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

  try {
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
  } finally {
    try { if (client) await client.close(); } catch { /* connection never opened */ }
  }
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limit: max 5 signups per IP per 15 minutes
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip")
      || "unknown";
    const rl = checkRateLimit("signup", clientIp, { maxRequests: 5, windowMs: 15 * 60_000 });
    if (!rl.allowed) {
      return rateLimitResponse(rl, corsHeaders, "Too many signup attempts. Please try again later.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, password, username, displayName, redirectUrl, referralCode }: SignupRequest = await req.json();
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
        // This can happen if a deletion partially succeeded in a self-hosted setup.
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

    // IMPORTANT: We intentionally do NOT use client-side auth.signUp here, because that
    // triggers the default provider confirmation email. Admin createUser avoids that.
    // Auto-confirm users immediately — no confirmation email needed
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName || email.split("@")[0],
        username: username?.toLowerCase(),
      },
    });

    if (createError) {
      // Normalize common cases
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

    // Helper to rollback user on failure
    const rollbackUser = async () => {
      console.error(`Rolling back user ${userId} due to signup failure`);
      await supabase.from("user_profiles").delete().eq("user_id", userId);
      await supabase.auth.admin.deleteUser(userId);
    };

    try {
      // Create profile row
      const { error: profileError } = await supabase.from("user_profiles").upsert({
        user_id: userId,
        display_name: displayName || email.split("@")[0],
        username: username?.toLowerCase() || null,
      }, { onConflict: "user_id" });

      if (profileError) {
        console.error("Profile creation failed:", profileError);
        await rollbackUser();
        return new Response(JSON.stringify({ error: "Failed to create user profile" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Confirm referral if a code was provided
      if (referralCode) {
        const { data: referral, error: refLookupErr } = await supabase
          .from("referrals")
          .select("id, referrer_user_id, referred_user_id")
          .eq("referral_code", referralCode.toLowerCase())
          .is("referred_user_id", null)
          .maybeSingle();

        if (!refLookupErr && referral && referral.referrer_user_id !== userId) {
          // Mark this referral as confirmed
          const { error: refUpdateErr } = await supabase
            .from("referrals")
            .update({ referred_user_id: userId, signed_up_at: new Date().toISOString() })
            .eq("id", referral.id);

          if (refUpdateErr) {
            // Non-fatal — log it but don't fail signup
            console.error("[Signup] Failed to confirm referral:", refUpdateErr.message);
          } else {
            // Trigger badge update via DB function
            await supabase.rpc("update_referral_badges", { _referrer_id: referral.referrer_user_id });
            console.log(`[Signup] Referral confirmed: ${referralCode} → referrer ${referral.referrer_user_id}`);
          }
        } else if (refLookupErr) {
          console.warn("[Signup] Referral lookup error (non-fatal):", refLookupErr.message);
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: "Account created! You can now sign in." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (innerError) {
      console.error("Signup inner error:", innerError);
      await rollbackUser();
      throw innerError;
    }
  } catch (error: any) {
    const msg = String(error?.message || error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

export default withLogging("signup", handler);

if (import.meta.main) {
  Deno.serve(withLogging("signup", handler));
}
