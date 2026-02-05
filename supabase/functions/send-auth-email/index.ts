import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AuthEmailRequest {
  type: 'password_reset' | 'email_confirmation';
  email: string;
  redirectUrl?: string;
}

const SMTP_SEND_TIMEOUT_MS = 8000;

function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
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

async function sendEmailSafely(sendFn: () => Promise<void>) {
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

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { type, email, redirectUrl }: AuthEmailRequest = await req.json();

    if (!email || !type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SMTP Configuration
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
    const smtpUser = Deno.env.get("SMTP_USER") || "";
    const smtpPass = Deno.env.get("SMTP_PASS") || "";
    const smtpFrom = Deno.env.get("SMTP_FROM");

    const requiresAuth = smtpPort !== 25;

    if (!smtpHost || !smtpFrom) {
      console.error("Missing SMTP configuration (SMTP_HOST/SMTP_FROM)");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (requiresAuth && (!smtpUser || !smtpPass)) {
      console.error("Missing SMTP credentials (SMTP_USER/SMTP_PASS)");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === 'password_reset') {
      // Check if user exists
      const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
      const user = userData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

      // Always return success to prevent email enumeration attacks
      if (!user) {
        console.log(`Password reset requested for non-existent email: ${email}`);
        return new Response(
          JSON.stringify({ success: true, message: "If an account exists, a reset email has been sent" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate secure token
      const token = generateSecureToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Invalidate any existing tokens for this email
      await supabase
        .from('password_reset_tokens')
        .delete()
        .eq('email', email.toLowerCase());

      // Store new token
      const { error: insertError } = await supabase
        .from('password_reset_tokens')
        .insert({
          user_id: user.id,
          email: email.toLowerCase(),
          token: token,
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) {
        console.error("Failed to store reset token:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to process request" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build reset URL
      const baseUrl = redirectUrl || 'https://gametaverns.com';
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;

      await sendEmailSafely(async () => {
        const connection: any = {
          hostname: smtpHost,
          port: smtpPort,
          tls: smtpPort === 465,
          // Port 587 = STARTTLS
          ...(smtpPort === 587 ? { starttls: true } : {}),
        };

        if (requiresAuth) {
          connection.auth = { username: smtpUser, password: smtpPass };
        }

        const client = new SMTPClient({
          connection,
        });

        try {
          const fromAddress = `GameTaverns <${smtpFrom}>`;
          await client.send({
            from: fromAddress,
            to: email,
            subject: "Reset Your GameTaverns Password",
            content: `Reset your password by visiting: ${resetUrl}`,
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
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #8B4513 0%, #654321 100%); padding: 30px; text-align: center;">
              <img src="https://ddfslywzgddlpmkhohfu.supabase.co/storage/v1/object/public/library-logos/platform-logo.png" alt="GameTaverns" style="max-height: 60px; width: auto; margin-bottom: 10px;" />
              <h1 style="color: #f5f0e6; margin: 0; font-size: 28px; font-weight: bold;">GameTaverns</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #f5f0e6; margin: 0 0 20px 0; font-size: 24px;">Reset Your Password</h2>
              <p style="color: #c9bfb0; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                You requested to reset your password for your GameTaverns account. Click the button below to set a new password:
              </p>
              <table cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td style="background: linear-gradient(135deg, #d97706 0%, #b45309 100%); border-radius: 6px;">
                    <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 16px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #8b7355; font-size: 14px; line-height: 1.5; margin: 0 0 10px 0;">
                This link will expire in 1 hour for security reasons.
              </p>
              <p style="color: #8b7355; font-size: 14px; line-height: 1.5; margin: 0;">
                If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
            </td>
          </tr>
          <!-- Footer -->
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
          console.log(`Password reset email queued for ${email}`);
        } finally {
          await client.close();
        }
      });

      return new Response(
        JSON.stringify({ success: true, message: "If an account exists, a reset email has been sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === 'email_confirmation') {
      // Generate secure token
      const token = generateSecureToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      // Get user ID from email (user was just created)
      const { data: userData } = await supabase.auth.admin.listUsers();
      const user = userData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

      if (!user) {
        console.error(`Email confirmation requested but user not found: ${email}`);
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Invalidate any existing tokens for this email
      await supabase
        .from('email_confirmation_tokens')
        .delete()
        .eq('email', email.toLowerCase());

      // Store new token
      const { error: insertError } = await supabase
        .from('email_confirmation_tokens')
        .insert({
          user_id: user.id,
          email: email.toLowerCase(),
          token: token,
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) {
        console.error("Failed to store confirmation token:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to process request" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build confirmation URL
      const baseUrl = redirectUrl || 'https://gametaverns.com';
      const confirmUrl = `${baseUrl}/verify-email?token=${token}`;

      await sendEmailSafely(async () => {
        const client = new SMTPClient({
          connection: {
            hostname: smtpHost,
            port: smtpPort,
            tls: smtpPort === 465,
            ...(smtpPort === 587 ? { starttls: true } : {}),
            auth: {
              username: smtpUser,
              password: smtpPass,
            },
          },
        });

        try {
          const fromAddress = `GameTaverns <${smtpFrom}>`;
          await client.send({
            from: fromAddress,
            to: email,
            subject: "Confirm Your GameTaverns Account",
            content: `Confirm your email by visiting: ${confirmUrl}`,
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
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #8B4513 0%, #654321 100%); padding: 30px; text-align: center;">
              <img src="https://ddfslywzgddlpmkhohfu.supabase.co/storage/v1/object/public/library-logos/platform-logo.png" alt="GameTaverns" style="max-height: 60px; width: auto; margin-bottom: 10px;" />
              <h1 style="color: #f5f0e6; margin: 0; font-size: 28px; font-weight: bold;">GameTaverns</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #f5f0e6; margin: 0 0 20px 0; font-size: 24px;">Welcome to GameTaverns!</h2>
              <p style="color: #c9bfb0; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Thanks for signing up! Please confirm your email address to activate your account and start building your board game library.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td style="background: linear-gradient(135deg, #d97706 0%, #b45309 100%); border-radius: 6px;">
                    <a href="${confirmUrl}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 16px;">
                      Confirm Email
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #8b7355; font-size: 14px; line-height: 1.5; margin: 0 0 10px 0;">
                This link will expire in 24 hours.
              </p>
              <p style="color: #8b7355; font-size: 14px; line-height: 1.5; margin: 0;">
                If you didn't create this account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
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
          console.log(`Email confirmation queued for ${email}`);
        } finally {
          await client.close();
        }
      });

      return new Response(
        JSON.stringify({ success: true, message: "Confirmation email queued" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid email type" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Auth email error:", error);

    const msg = String(error?.message || error);
    
    // Helpful hints for common SMTP TLS errors
    if (msg.includes("NotValidForName")) {
      return new Response(
        JSON.stringify({
          error: "SMTP TLS certificate name mismatch. Update SMTP_HOST to match the server's TLS certificate hostname.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    
    if (msg.includes("CaUsedAsEndEntity")) {
      return new Response(
        JSON.stringify({
          error: "SMTP server TLS certificate issue (CA used as end entity). The mail server's certificate chain may be misconfigured.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
