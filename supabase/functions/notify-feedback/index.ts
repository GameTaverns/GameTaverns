import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

const FEEDBACK_TYPE_LABELS: Record<string, string> = {
  feedback: "💬 General Feedback",
  bug: "🐛 Bug Report",
  feature_request: "✨ Feature Request",
  badge_request: "🏅 Badge Request",
};

const FEEDBACK_COLORS: Record<string, number> = {
  feedback: 0x3b82f6,
  bug: 0xef4444,
  feature_request: 0x8b5cf6,
  badge_request: 0xf59e0b,
};

const FEEDBACK_FORUM_CHANNELS: Record<string, string> = {
  feedback: "1472011480105746635",
  bug: "1472011323670794302",
  feature_request: "1472011413512917033",
  badge_request: "1477156452199043106",
};

const DISCORD_API = "https://discord.com/api/v10";

const handler = async (req: Request): Promise<Response> => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  try {
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");

    const { type, sender_name, sender_email, message, screenshot_urls, feedback_id } = await req.json();

    if (!type || !sender_name || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const urls: string[] = Array.isArray(screenshot_urls) ? screenshot_urls : [];
    console.log("Received feedback:", { type, sender_name, screenshot_count: urls.length, urls, feedback_id });
    const results: Record<string, unknown> = {};

    // 1. Post to Discord forum channel
    const channelId = FEEDBACK_FORUM_CHANNELS[type];
    if (botToken && channelId) {
      try {
        const embed: Record<string, unknown> = {
          title: FEEDBACK_TYPE_LABELS[type] || "📝 Feedback",
          description: message.substring(0, 4000),
          color: FEEDBACK_COLORS[type] || 0x3b82f6,
          fields: [
            { name: "From", value: sender_name, inline: true },
          ],
          footer: { text: "GameTaverns Platform Feedback" },
          timestamp: new Date().toISOString(),
        };

        // Attach first image as embed image
        if (urls.length > 0) {
          embed.image = { url: urls[0] };
        }

        const embeds = [embed];

        // Additional images as separate embeds (Discord supports up to 10 embeds)
        for (let i = 1; i < Math.min(urls.length, 4); i++) {
          embeds.push({ image: { url: urls[i] }, color: FEEDBACK_COLORS[type] || 0x3b82f6 });
        }

        const threadName = `${sender_name} - ${message.substring(0, 80)}`.substring(0, 100);

        const response = await fetch(`${DISCORD_API}/channels/${channelId}/threads`, {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: threadName,
            message: { embeds },
            auto_archive_duration: 1440,
          }),
        });

        if (response.ok) {
          const thread = await response.json();
          results.discord = { sent: true, thread_id: thread.id };

          // Save the Discord thread ID back to the feedback record
          if (feedback_id && thread.id) {
            try {
              const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
              const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
              const supabase = createClient(supabaseUrl, serviceRoleKey);

              await supabase
                .from("platform_feedback")
                .update({ discord_thread_id: thread.id })
                .eq("id", feedback_id);

              console.log("Saved discord_thread_id", thread.id, "to feedback", feedback_id);
            } catch (e) {
              console.error("Failed to save discord_thread_id:", (e as Error).message);
            }
          }
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

    // 2. Send email with inline images
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

        // Build screenshot HTML
        const screenshotHtml = urls.length > 0
          ? `<h3>Screenshots</h3>${urls.map((u: string, i: number) => `<p><a href="${u}"><img src="${u}" alt="Screenshot ${i + 1}" style="max-width:600px;max-height:400px;border:1px solid #ddd;border-radius:4px;margin:4px 0;" /></a></p>`).join("")}`
          : "";

        await client.send({
          from: smtpFrom,
          to: "admin@gametaverns.com",
          replyTo: sender_email || smtpFrom,
          subject: `[GameTaverns] ${typeLabel} from ${sender_name}`,
          headers: {
            "List-Unsubscribe": `<mailto:unsubscribe@gametaverns.com?subject=unsubscribe>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          html: `<h2>${typeLabel}</h2>
<p><strong>From:</strong> ${sender_name}${sender_email ? ` (${sender_email})` : ""}</p>
<hr />
<p>${message.replace(/\n/g, "<br />")}</p>
${screenshotHtml}
<hr />
<p style="color: #888; font-size: 12px;">This feedback was submitted via the GameTaverns platform.</p>`,
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
