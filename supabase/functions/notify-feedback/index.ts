import { createClient } from "npm:@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");

    const { type, sender_name, sender_email, message } = await req.json();

    if (!type || !sender_name || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const results: Record<string, unknown> = {};

    // 1. Send Discord DMs to all admins
    if (botToken) {
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (admins && admins.length > 0) {
        const embed = {
          title: FEEDBACK_TYPE_LABELS[type] || "📝 Feedback",
          description: message.substring(0, 2000),
          color: FEEDBACK_COLORS[type] || 0x3b82f6,
          fields: [
            { name: "From", value: sender_name, inline: true },
            ...(sender_email ? [{ name: "Email", value: sender_email, inline: true }] : []),
          ],
          footer: { text: "GameTaverns Platform Feedback" },
          timestamp: new Date().toISOString(),
        };

        for (const admin of admins) {
          try {
            await fetch(`${supabaseUrl}/functions/v1/discord-send-dm`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({ user_id: admin.user_id, embed }),
            });
          } catch (e) {
            console.error(`Discord DM to admin ${admin.user_id} failed:`, (e as Error).message);
          }
        }
        results.discord = "sent";
      }
    }

    // 2. Send email to admin@gametaverns.com
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
});
