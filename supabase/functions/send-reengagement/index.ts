import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, userEmail, userName } = await req.json();
    if (!userId || !userEmail) {
      return new Response(JSON.stringify({ error: "userId and userEmail required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch recent platform updates (resolved feedback items)
    const { data: recentUpdates } = await supabase
      .from("platform_feedback")
      .select("title, type, resolved_at")
      .eq("status", "resolved")
      .order("resolved_at", { ascending: false })
      .limit(8);

    const updatesList = (recentUpdates || [])
      .map((u: any) => {
        const typeEmoji = u.type === "bug" ? "🐛" : u.type === "feature" ? "✨" : "🔧";
        const label = u.type === "bug" ? "Fix" : u.type === "feature" ? "New" : "Improved";
        return `<tr><td style="padding:8px 12px 8px 0;color:#78705e;font-size:13px;vertical-align:top;">${typeEmoji}</td><td style="padding:8px 0;color:#3d2b1f;font-size:13px;"><strong style="color:#556b2f;">${label}:</strong> ${escapeHtml(u.title)}</td></tr>`;
      })
      .join("");

    // Fetch upcoming public events
    const { data: upcomingEvents } = await supabase
      .from("library_events")
      .select("title, event_date, venue_name, event_location")
      .eq("is_public", true)
      .eq("status", "published")
      .gte("event_date", new Date().toISOString())
      .order("event_date", { ascending: true })
      .limit(3);

    const eventsHtml = (upcomingEvents || []).length > 0
      ? [
          '<div style="background:#efe5cf;border:1px solid #d4c4a0;border-radius:8px;padding:20px;margin:0 0 24px;">',
          '<p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#3d2b1f;">🗓️ Upcoming Events</p>',
          '<table style="width:100%;border-collapse:collapse;">',
          ...(upcomingEvents || []).map((e: any) => {
            const d = new Date(e.event_date);
            const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            const loc = e.venue_name || e.event_location || "";
            return `<tr><td style="padding:6px 12px 6px 0;color:#556b2f;font-size:13px;font-weight:600;vertical-align:top;white-space:nowrap;">${dateStr}</td><td style="padding:6px 0;color:#3d2b1f;font-size:13px;">${escapeHtml(e.title)}${loc ? `<br><span style="color:#9a8a6e;font-size:11px;">📍 ${escapeHtml(loc)}</span>` : ""}</td></tr>`;
          }),
          '</table>',
          '</div>',
        ].join("")
      : "";

    // Fetch platform stats
    const { count: totalLibraries } = await supabase
      .from("libraries")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    const { count: totalGames } = await supabase
      .from("games")
      .select("*", { count: "exact", head: true })
      .eq("ownership_status", "owned");

    const statsHtml = `<div style="text-align:center;margin:0 0 24px;">
      <table style="margin:0 auto;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 20px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:#556b2f;">${totalLibraries || 0}</div>
            <div style="font-size:11px;color:#9a8a6e;text-transform:uppercase;letter-spacing:1px;">Libraries</div>
          </td>
          <td style="padding:8px 20px;text-align:center;border-left:1px solid #d4c4a0;">
            <div style="font-size:24px;font-weight:700;color:#556b2f;">${totalGames || 0}</div>
            <div style="font-size:11px;color:#9a8a6e;text-transform:uppercase;letter-spacing:1px;">Games</div>
          </td>
          <td style="padding:8px 20px;text-align:center;border-left:1px solid #d4c4a0;">
            <div style="font-size:24px;font-weight:700;color:#556b2f;">${(recentUpdates || []).length}</div>
            <div style="font-size:11px;color:#9a8a6e;text-transform:uppercase;letter-spacing:1px;">Updates</div>
          </td>
        </tr>
      </table>
    </div>`;

    const displayName = userName || userEmail.split("@")[0];
    const logoUrl = "https://gametaverns.com/gt-logo.png";

    const htmlBody = [
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
      '<body style="margin:0;padding:0;background:#e8dcc8;font-family:Georgia,Times New Roman,serif;">',
      '<div style="max-width:560px;margin:0 auto;padding:24px;">',
      '<div style="background:#f5eed9;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(60,40,20,0.15);border:1px solid #d4c4a0;">',
      // Header
      '<div style="background:#3d2b1f;padding:24px 32px;text-align:center;">',
      `<img src="${logoUrl}" alt="GameTaverns" style="max-height:48px;margin-bottom:4px;" />`,
      '<p style="margin:0;color:#e8d9b0;font-size:13px;font-family:Georgia,serif;">We Miss You!</p>',
      '</div>',
      // Body
      '<div style="padding:32px;">',
      `<p style="margin:0 0 16px;font-size:15px;color:#3d2b1f;">Hi ${escapeHtml(displayName)},</p>`,
      '<p style="margin:0 0 20px;font-size:15px;color:#3d2b1f;line-height:1.6;">',
      "We noticed you haven't visited in a while — and a lot has happened since your last visit! The community has been growing, and we've been busy making GameTaverns even better.",
      '</p>',
      // Stats
      statsHtml,
      // Updates section
      updatesList ? [
        '<div style="background:#efe5cf;border:1px solid #d4c4a0;border-radius:8px;padding:20px;margin:0 0 24px;">',
        '<p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#3d2b1f;">✨ Recent Updates &amp; Fixes</p>',
        '<table style="width:100%;border-collapse:collapse;">',
        updatesList,
        '</table>',
        '</div>',
      ].join("") : "",
      // Events section
      eventsHtml,
      '<p style="margin:0 0 24px;font-size:15px;color:#3d2b1f;line-height:1.6;">',
      'Your library is still here waiting for you. Come check out what\'s new, log some plays, or see what the community has been up to!',
      '</p>',
      // CTA
      '<div style="text-align:center;margin:0 0 24px;">',
      '<a href="https://gametaverns.com" style="display:inline-block;background:#556b2f;color:#f5eed9;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">Visit GameTaverns →</a>',
      '</div>',
      '<hr style="border:none;border-top:1px solid #d4c4a0;margin:24px 0;">',
      '<p style="margin:0;font-size:12px;color:#9a8a6e;text-align:center;">',
      'You\'re receiving this because you have an account at <a href="https://gametaverns.com" style="color:#556b2f;">GameTaverns</a>.<br>',
      'If you\'d like to stop receiving these emails, reply and let us know.',
      '</p>',
      '</div></div></div>',
      '</body></html>',
    ].join("");

    // Send via SMTP (dynamic import like reply-feedback)
    const SMTP_HOST = Deno.env.get("SMTP_HOST");
    const SMTP_FROM = Deno.env.get("SMTP_FROM");
    if (!SMTP_HOST || !SMTP_FROM) {
      return new Response(JSON.stringify({ error: "SMTP not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");

    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
    const smtpUser = Deno.env.get("SMTP_USER") || "";
    const smtpPass = Deno.env.get("SMTP_PASS") || "";
    const isRelay = smtpPort === 25;

    const clientConfig: Record<string, unknown> = {
      connection: {
        hostname: SMTP_HOST,
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

    await client.send({
      from: SMTP_FROM,
      to: userEmail,
      subject: `We miss you at GameTaverns, ${displayName}! 🎲`,
      html: htmlBody,
    });

    await client.close();

    // Log in audit
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "reengagement_email_sent",
      details: { target_user_id: userId, target_email: userEmail },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Re-engagement email error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

export default handler;

if (import.meta.main) {
  Deno.serve(handler);
}
