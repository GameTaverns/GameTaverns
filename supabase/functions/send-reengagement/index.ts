import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

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

function generateUnsubscribeToken(userId: string, secret: string): string {
  return createHmac("sha256", secret).update(userId).digest("hex");
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

    // Check if user has opted out of marketing emails
    const { data: profileData } = await supabase
      .from("user_profiles")
      .select("marketing_emails_opted_out")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileData?.marketing_emails_opted_out) {
      return new Response(JSON.stringify({ error: "User has unsubscribed from marketing emails" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Hardcoded "What's New" updates ─────────────────────────────────────
    const updatesHtml = [
      '<div style="background:#efe5cf;border:1px solid #d4c4a0;border-radius:8px;padding:20px;margin:0 0 24px;">',
      '<p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#3d2b1f;">What\'s New Since You Left</p>',
      '<p style="margin:0 0 8px;font-size:12px;color:#9a8a6e;">Here\'s what the team has been working on:</p>',
      // Features
      '<p style="margin:16px 0 8px;font-size:13px;font-weight:700;color:#556b2f;">✨ New Features</p>',
      '<ul style="margin:0;padding:0 0 0 20px;">',
      '<li style="margin:0 0 8px;font-size:13px;color:#3d2b1f;line-height:1.5;"><strong>Game Catalog</strong> — Browse over 150,000 board games and add any to your library with a single click</li>',
      '<li style="margin:0 0 8px;font-size:13px;color:#3d2b1f;line-height:1.5;"><strong>Curated Lists</strong> — Create, share, and vote on custom game lists with the community</li>',
      '<li style="margin:0 0 8px;font-size:13px;color:#3d2b1f;line-height:1.5;"><strong>Direct Messages</strong> — Private messaging between users with a floating chat bar</li>',
      '<li style="margin:0 0 8px;font-size:13px;color:#3d2b1f;line-height:1.5;"><strong>Public Events Directory</strong> — Discover and create game nights, tournaments, and conventions open to the community</li>',
      '<li style="margin:0 0 8px;font-size:13px;color:#3d2b1f;line-height:1.5;"><strong>Photo Gallery</strong> — Upload gameplay photos, tag games, and share moments from your sessions</li>',
      '</ul>',
      // Improvements
      '<p style="margin:16px 0 8px;font-size:13px;font-weight:700;color:#6b5b3e;">🔧 Improvements</p>',
      '<ul style="margin:0;padding:0 0 0 20px;">',
      '<li style="margin:0 0 8px;font-size:13px;color:#3d2b1f;line-height:1.5;"><strong>Smarter Imports</strong> — Drop in a BGStats export and we\'ll auto-detect your games and play history. Plus CSV, Excel, and BGG sync</li>',
      '<li style="margin:0 0 8px;font-size:13px;color:#3d2b1f;line-height:1.5;"><strong>Event Planning Upgrades</strong> — Table assignments, registration caps, game lineups, and automated RSVP emails with calendar invites</li>',
      '<li style="margin:0 0 8px;font-size:13px;color:#3d2b1f;line-height:1.5;"><strong>Social Features</strong> — Activity feed reactions, real-time online presence indicators, and referral tracking</li>',
      '<li style="margin:0 0 8px;font-size:13px;color:#3d2b1f;line-height:1.5;"><strong>Catalog Analytics</strong> — Leaderboards for most-owned, most-played, and highest-rated games across the platform</li>',
      '</ul>',
      '</div>',
    ].join("");

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
            <div style="font-size:24px;font-weight:700;color:#556b2f;">150K+</div>
            <div style="font-size:11px;color:#9a8a6e;text-transform:uppercase;letter-spacing:1px;">In Catalog</div>
          </td>
        </tr>
      </table>
    </div>`;

    const displayName = userName || userEmail.split("@")[0];
    const logoUrl = "https://gametaverns.com/gt-logo.png";

    // Generate unsubscribe link
    const unsubSecret = Deno.env.get("PII_ENCRYPTION_KEY") || serviceKey;
    const unsubToken = generateUnsubscribeToken(userId, unsubSecret);
    // Use SITE_URL for public-facing links (SUPABASE_URL may be internal kong)
    const siteUrl = Deno.env.get("SITE_URL") || "https://gametaverns.com";
    const publicFunctionsBase = `${siteUrl.replace(/\/$/, "")}/functions/v1`;
    const unsubscribeUrl = `${publicFunctionsBase}/email-unsubscribe?uid=${userId}&token=${unsubToken}`;
    const trackOpenUrl = `${publicFunctionsBase}/email-track?t=open&uid=${userId}`;
    const trackClickUrl = (dest: string) => `${publicFunctionsBase}/email-track?t=click&uid=${userId}&r=${encodeURIComponent(dest)}`;

    const ctaUrl = trackClickUrl("https://gametaverns.com");

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
      updatesHtml,
      // Events section
      eventsHtml,
      '<p style="margin:0 0 24px;font-size:15px;color:#3d2b1f;line-height:1.6;">',
      'Your library is still here waiting for you. Come check out what\'s new, browse the catalog, log some plays, or see what the community has been up to!',
      '</p>',
      // CTA
      '<div style="text-align:center;margin:0 0 24px;">',
      `<a href="${ctaUrl}" style="display:inline-block;background:#556b2f;color:#f5eed9;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">Visit GameTaverns →</a>`,
      '</div>',
      '<hr style="border:none;border-top:1px solid #d4c4a0;margin:24px 0;">',
      '<p style="margin:0;font-size:12px;color:#9a8a6e;text-align:center;">',
      'You\'re receiving this because you have an account at <a href="https://gametaverns.com" style="color:#556b2f;">GameTaverns</a>.<br>',
      `<a href="${unsubscribeUrl}" style="color:#556b2f;">Unsubscribe</a> · <a href="https://gametaverns.com" style="color:#556b2f;">Manage email preferences</a>`,
      '</p>',
      '</div></div></div>',
      `<img src="${trackOpenUrl}" width="1" height="1" alt="" style="display:none;" />`,
      '</body></html>',
    ].join("");

    // Send via SMTP
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
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    await client.close();

    // Log in audit + email events table
    await Promise.all([
      supabase.from("audit_log").insert({
        user_id: user.id,
        action: "reengagement_email_sent",
        details: { target_user_id: userId, target_email: userEmail },
      }),
      supabase.from("reengagement_email_events").insert({
        user_id: userId,
        event_type: "sent",
        metadata: { sent_by: user.id },
      }),
    ]);

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
