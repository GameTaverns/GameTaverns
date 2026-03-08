import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { feedback_id } = await req.json();

    if (!feedback_id) {
      return new Response(
        JSON.stringify({ error: "feedback_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = (Deno.env.get("SUPABASE_URL") || Deno.env.get("API_EXTERNAL_URL") || "").trim();
    const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "").trim();

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch the feedback record
    const { data: feedback, error: fbError } = await supabase
      .from("platform_feedback")
      .select("sender_name, sender_email, type, message")
      .eq("id", feedback_id)
      .single();

    if (fbError || !feedback) {
      console.error("Feedback not found:", fbError);
      return new Response(
        JSON.stringify({ error: "Feedback not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!feedback.sender_email) {
      return new Response(
        JSON.stringify({ success: true, email: "no_email_on_record" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email via SMTP
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpFrom = Deno.env.get("SMTP_FROM");

    if (!smtpHost || !smtpFrom) {
      console.log("SMTP not configured, skipping closure email");
      return new Response(
        JSON.stringify({ success: true, email: "smtp_not_configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");

    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587", 10);
    const smtpUser = Deno.env.get("SMTP_USER") || "";
    const smtpPass = Deno.env.get("SMTP_PASS") || "";
    const isRelay = smtpPort === 25;

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: smtpPort === 465,
        auth: isRelay ? undefined : { username: smtpUser, password: smtpPass },
      },
      debug: {
        noStartTLS: isRelay,
        allowUnsecure: isRelay,
      },
    } as any);

    const FEEDBACK_TYPE_LABELS: Record<string, string> = {
      feedback: "General Feedback",
      bug: "Bug Report",
      feature_request: "Feature Request",
      badge_request: "Badge Request",
    };

    const typeLabel = FEEDBACK_TYPE_LABELS[feedback.type] || "Feedback";
    const siteUrl = Deno.env.get("SITE_URL") || "https://gametaverns.com";
    const siteName = Deno.env.get("SITE_NAME") || "GameTaverns";
    const originalMessage = feedback.message.length > 200
      ? feedback.message.substring(0, 200) + "…"
      : feedback.message;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ticket Closed</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .card { background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .header img { max-height: 60px; }
          .badge { display: inline-block; padding: 6px 14px; background: #10b981; color: #ffffff; border-radius: 20px; font-weight: 600; font-size: 13px; letter-spacing: 0.5px; }
          .original { background: #f9fafb; border-left: 3px solid #d1d5db; padding: 12px 16px; margin: 20px 0; border-radius: 0 4px 4px 0; color: #6b7280; font-size: 14px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          h1 { color: #333; margin-bottom: 20px; }
          p { color: #555; line-height: 1.6; }
          .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #d97706, #c2410c); color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <img src="${siteUrl}/logo.png" alt="${siteName}">
            </div>
            <h1>Your Ticket Has Been Closed</h1>
            <p>Hi ${feedback.sender_name},</p>
            <p>We wanted to let you know that your <strong>${typeLabel}</strong> ticket has been reviewed and closed by our team.</p>
            <div class="original">
              <strong>Your original message:</strong><br>
              ${originalMessage.replace(/\n/g, "<br>")}
            </div>
            <p>If you feel this issue hasn't been fully resolved, you can always submit a new ticket through the platform.</p>
            <p style="text-align: center;">
              <a href="${siteUrl}" class="button">Visit ${siteName}</a>
            </p>
            <p style="color: #888; font-size: 13px;">Thank you for helping us improve the platform!</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await client.send({
      from: smtpFrom,
      to: feedback.sender_email,
      subject: `[${siteName}] Your ${typeLabel} ticket has been closed`,
      headers: {
        "List-Unsubscribe": `<mailto:unsubscribe@gametaverns.com?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      html,
    });

    await client.close();
    console.log("Ticket closure email sent to", feedback.sender_email);

    return new Response(
      JSON.stringify({ success: true, email: "sent" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("notify-feedback-closed error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

export default handler;

if (import.meta.main) {
  Deno.serve(handler);
}
