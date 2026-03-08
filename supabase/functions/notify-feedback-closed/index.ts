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
    const logoUrl = `${siteUrl}/gt-logo.png`;
    const originalMessage = feedback.message.length > 200
      ? feedback.message.substring(0, 200) + "…"
      : feedback.message;
    const escapedMessage = originalMessage.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
    const recipientLabel = feedback.sender_name || feedback.sender_email;

    const html = [
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
      '<body style="margin:0;padding:0;background:#e8dcc8;font-family:Georgia,\'Times New Roman\',serif;">',
      '<div style="max-width:560px;margin:0 auto;padding:24px;">',
      '<div style="background:#f5eed9;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(60,40,20,0.15);border:1px solid #d4c4a0;">',
      '<div style="background:#3d2b1f;padding:24px 32px;text-align:center;">',
      `<img src="${logoUrl}" alt="${siteName}" style="max-height:48px;margin-bottom:8px;" />`,
      '<p style="margin:0;color:#e8d9b0;font-size:13px;font-family:Georgia,serif;">Ticket Closed</p>',
      '</div>',
      '<div style="padding:32px;">',
      `<p style="margin:0 0 16px;font-size:15px;color:#3d2b1f;">Hi ${recipientLabel},</p>`,
      `<p style="color:#3d2b1f;font-size:14px;line-height:1.7;margin:0 0 16px;">We wanted to let you know that your <strong>${typeLabel}</strong> ticket has been reviewed and closed by our team.</p>`,
      '<div style="background:#efe5cf;border:1px solid #d4c4a0;border-radius:8px;padding:20px;margin:0 0 24px;">',
      '<p style="margin:0 0 8px;font-size:12px;color:#9a8a6e;font-weight:bold;">YOUR ORIGINAL MESSAGE</p>',
      `<p style="color:#3d2b1f;font-size:14px;line-height:1.7;white-space:pre-wrap;margin:0;">${escapedMessage}</p>`,
      '</div>',
      '<p style="color:#78705e;font-size:13px;margin:0 0 24px;">If you feel this issue hasn\'t been fully resolved, you can always submit a new ticket through the platform.</p>',
      '<div style="text-align:center;margin:24px 0 8px;">',
      `<a href="${siteUrl}" style="display:inline-block;background:#556b2f;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;font-family:Georgia,serif;">Visit ${siteName}</a>`,
      '</div>',
      '<hr style="border:none;border-top:1px solid #d4c4a0;margin:24px 0;">',
      '<p style="margin:0;font-size:12px;color:#9a8a6e;text-align:center;">',
      `Thank you for helping us improve the platform! &copy; ${new Date().getFullYear()} <a href="${siteUrl}" style="color:#556b2f;">${siteName}</a>.`,
      '</p>',
      '</div></div></div>',
      '</body></html>',
    ].join("");

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
