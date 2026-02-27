const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to_email, to_name, subject, message, from_name } = await req.json();

    if (!to_email || !message) {
      return new Response(
        JSON.stringify({ error: "to_email and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SMTP_HOST = Deno.env.get("SMTP_HOST");
    const SMTP_PORT = Deno.env.get("SMTP_PORT") || "587";
    const SMTP_USER = Deno.env.get("SMTP_USER");
    const SMTP_PASS = Deno.env.get("SMTP_PASS");
    const SMTP_FROM = Deno.env.get("SMTP_FROM");

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
      console.error("Missing SMTP configuration");
      return new Response(
        JSON.stringify({ error: "SMTP not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");

    const port = Number(SMTP_PORT);
    const isRelay = port === 25;
    const useImplicitTls = port === 465;

    const clientConfig: Record<string, unknown> = {
      connection: {
        hostname: SMTP_HOST,
        port,
        tls: useImplicitTls,
        auth: isRelay ? undefined : { username: SMTP_USER, password: SMTP_PASS },
      },
      debug: {
        noStartTLS: isRelay,
        allowUnsecure: isRelay,
      },
    };

    const client = new SMTPClient(clientConfig as any);

    const senderLabel = "GameTaverns Staff";
    const recipientLabel = to_name || to_email;

    const logoUrl = "https://gametaverns.com/gt-logo.png";
    const escapedMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const htmlBody = [
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
      '<body style="margin:0;padding:0;background:#e8dcc8;font-family:Georgia,\'Times New Roman\',serif;">',
      '<div style="max-width:560px;margin:0 auto;padding:24px;">',
      '<div style="background:#f5eed9;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(60,40,20,0.15);border:1px solid #d4c4a0;">',
      // Header with logo
      '<div style="background:#3d2b1f;padding:24px 32px;text-align:center;">',
      `<img src="${logoUrl}" alt="GameTaverns" style="max-height:48px;margin-bottom:8px;" />`,
      '<p style="margin:0;color:#e8d9b0;font-size:13px;font-family:Georgia,serif;">Staff Response</p>',
      '</div>',
      // Body
      '<div style="padding:32px;">',
      `<p style="margin:0 0 16px;font-size:15px;color:#3d2b1f;">Hi ${recipientLabel},</p>`,
      '<div style="background:#efe5cf;border:1px solid #d4c4a0;border-radius:8px;padding:20px;margin:0 0 24px;">',
      `<p style="color:#3d2b1f;font-size:14px;line-height:1.7;white-space:pre-wrap;margin:0;">${escapedMessage}</p>`,
      '</div>',
      `<p style="color:#78705e;font-size:13px;margin:0 0 24px;">— ${senderLabel}</p>`,
      '<hr style="border:none;border-top:1px solid #d4c4a0;margin:24px 0;">',
      '<p style="margin:0;font-size:12px;color:#9a8a6e;text-align:center;">',
      'This is a reply to feedback you submitted on <a href="https://gametaverns.com" style="color:#556b2f;">GameTaverns</a>.',
      '</p>',
      '</div></div></div>',
      '</body></html>',
    ].join("");

    await client.send({
      from: SMTP_FROM,
      to: to_email,
      subject: subject || "Re: Your feedback — Game Taverns",
      content: "auto",
      html: htmlBody,
    });

    await client.close();

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Reply feedback error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send reply" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

export default handler;

if (import.meta.main) {
  Deno.serve(handler);
}
