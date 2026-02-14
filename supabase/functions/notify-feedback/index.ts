const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FEEDBACK_TYPE_LABELS: Record<string, string> = {
  feedback: "💬 General Feedback",
  bug: "🐛 Bug Report",
  feature_request: "✨ Feature Request",
};

const FEEDBACK_COLORS: Record<string, number> = {
  feedback: 0x3b82f6,       // Blue
  bug: 0xef4444,            // Red
  feature_request: 0x8b5cf6, // Purple
};

// Discord forum channel IDs for each feedback type
const FEEDBACK_FORUM_CHANNELS: Record<string, string> = {
  feedback: "1472011480105746635",
  bug: "1472011323670794302",
  feature_request: "1472011413512917033",
};

const DISCORD_API = "https://discord.com/api/v10";

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");

    const { type, sender_name, sender_email, message } = await req.json();

    if (!type || !sender_name || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Record<string, unknown> = {};

    // 1. Post to Discord forum channel (name + message only, no email)
    const channelId = FEEDBACK_FORUM_CHANNELS[type];
    if (botToken && channelId) {
      try {
        const embed = {
          title: FEEDBACK_TYPE_LABELS[type] || "📝 Feedback",
          description: message.substring(0, 4000),
          color: FEEDBACK_COLORS[type] || 0x3b82f6,
          fields: [
            { name: "From", value: sender_name, inline: true },
          ],
          footer: { text: "GameTaverns Platform Feedback" },
          timestamp: new Date().toISOString(),
        };

        const threadName = `${sender_name} - ${message.substring(0, 80)}`.substring(0, 100);

        const response = await fetch(`${DISCORD_API}/channels/${channelId}/threads`, {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: threadName,
            message: { embeds: [embed] },
            auto_archive_duration: 1440,
          }),
        });

        if (response.ok) {
          const thread = await response.json();
          results.discord = { sent: true, thread_id: thread.id };
        } else {
          const errorText = await response.text();
          console.error("Discord forum post failed:", response.status, errorText);
          results.discord = { sent: false, error: errorText };
        }
      } catch (e) {
        console.error("Discord forum post error:", (e as Error).message);
        results.discord = { sent: false, error: (e as Error).message };
      }
    } else {
      results.discord = "not_configured";
    }

    // 2. Send email to admin@gametaverns.com with reply-to as user's email
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpFrom = Deno.env.get("SMTP_FROM");
    if (smtpHost && smtpFrom) {
      try {
        const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");

        const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587", 10);
        const smtpUser = Deno.env.get("SMTP_USER") || "";
        const smtpPass = Deno.env.get("SMTP_PASS") || "";
        const isRelay = smtpPort === 25;

        const clientConfig: Record<string, unknown> = {
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
        };

        const client = new SMTPClient(clientConfig as any);

        const typeLabel = FEEDBACK_TYPE_LABELS[type] || "Feedback";

        await client.send({
          from: smtpFrom,
          to: "admin@gametaverns.com",
          replyTo: sender_email || smtpFrom,
          subject: `[GameTaverns] ${typeLabel} from ${sender_name}`,
          html: `
            <h2>${typeLabel}</h2>
            <p><strong>From:</strong> ${sender_name}${sender_email ? ` (${sender_email})` : ""}</p>
            <hr />
            <p>${message.replace(/\n/g, "<br />")}</p>
            <hr />
            <p style="color: #888; font-size: 12px;">This feedback was submitted via the GameTaverns platform.</p>
          `,
        });

        await client.close();
        results.email = "sent";
      } catch (e) {
        console.error("Email send error:", (e as Error).message);
        results.email = "failed";
      }
    } else {
      results.email = "not_configured";
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("notify-feedback error:", error);
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
