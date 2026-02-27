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
    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port,
        tls: port === 465,
        auth: {
          username: SMTP_USER,
          password: SMTP_PASS,
        },
        ...(port === 25 ? { noStartTLS: true, allowUnsecure: true } : {}),
      },
    });

    const senderLabel = from_name || "Game Taverns Staff";
    const recipientLabel = to_name || to_email;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #f9f7f4; border-radius: 12px; padding: 32px; border: 1px solid #e8e0d4;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h2 style="color: #2d2418; margin: 0;">Game Taverns</h2>
      <p style="color: #8b7355; font-size: 14px; margin: 4px 0 0;">Staff Response</p>
    </div>
    <p style="color: #4a3f35; font-size: 15px;">Hi ${recipientLabel},</p>
    <div style="background: #ffffff; border-radius: 8px; padding: 20px; margin: 16px 0; border: 1px solid #e8e0d4;">
      <p style="color: #2d2418; font-size: 14px; line-height: 1.6; white-space: pre-wrap; margin: 0;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
    </div>
    <p style="color: #8b7355; font-size: 13px; margin-top: 16px;">— ${senderLabel}</p>
    <hr style="border: none; border-top: 1px solid #e8e0d4; margin: 24px 0;" />
    <p style="color: #b0a08a; font-size: 11px; text-align: center;">
      This is a reply to feedback you submitted on Game Taverns.
    </p>
  </div>
</body>
</html>`;

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
Deno.serve(handler);
