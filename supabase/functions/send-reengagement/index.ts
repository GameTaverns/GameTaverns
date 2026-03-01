import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function handler(req: Request): Promise<Response> {
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

    // Fetch recent platform updates (changelog-style from platform_feedback resolved items)
    const { data: recentUpdates } = await supabase
      .from("platform_feedback")
      .select("title, type, resolved_at")
      .eq("status", "resolved")
      .order("resolved_at", { ascending: false })
      .limit(8);

    const updatesList = (recentUpdates || [])
      .map((u: any) => {
        const typeEmoji = u.type === "bug" ? "🐛" : u.type === "feature" ? "✨" : "🔧";
        return `<li style="margin-bottom:8px;">${typeEmoji} <strong>${escapeHtml(u.title)}</strong></li>`;
      })
      .join("");

    const displayName = userName || userEmail.split("@")[0];

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="color:#3a2e1f;font-size:28px;margin:0;">🏰 GameTaverns</h1>
      <p style="color:#6b5d4a;font-size:14px;margin:4px 0 0;">Your Board Game Community</p>
    </div>
    
    <div style="background:#ffffff;border-radius:12px;padding:32px;border:1px solid #d4c8b0;">
      <h2 style="color:#3a2e1f;font-size:20px;margin:0 0 16px;">Hey ${escapeHtml(displayName)}! 👋</h2>
      
      <p style="color:#5a4e3a;font-size:15px;line-height:1.6;margin:0 0 16px;">
        We noticed you haven't visited in a while — and a lot has happened since your last visit! 
        The community has been growing, and we've been busy making GameTaverns even better.
      </p>

      ${updatesList ? `
      <div style="background:#f9f6f0;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #8b7355;">
        <h3 style="color:#3a2e1f;font-size:16px;margin:0 0 12px;">Recent Updates & Fixes</h3>
        <ul style="color:#5a4e3a;font-size:14px;line-height:1.5;padding-left:16px;margin:0;">
          ${updatesList}
        </ul>
      </div>
      ` : ""}

      <p style="color:#5a4e3a;font-size:15px;line-height:1.6;margin:16px 0;">
        Your library is still here waiting for you. Come check out what's new, 
        log some plays, or see what the community has been up to!
      </p>

      <div style="text-align:center;margin:28px 0 16px;">
        <a href="https://gametaverns.com" 
           style="display:inline-block;background:#5c4a2e;color:#f5f0e8;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:bold;">
          Visit GameTaverns →
        </a>
      </div>
    </div>

    <p style="color:#8b7d6b;font-size:12px;text-align:center;margin:24px 0 0;line-height:1.5;">
      You're receiving this because you have an account at GameTaverns.<br>
      If you'd like to stop receiving these emails, reply and let us know.
    </p>
  </div>
</body>
</html>`;

    // Send via SMTP
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpFrom = Deno.env.get("SMTP_FROM");
    if (!smtpHost || !smtpFrom) {
      return new Response(JSON.stringify({ error: "SMTP not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
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
        ...(isRelay ? { allowUnsecure: true, noStartTLS: true } : {}),
      },
    };

    const client = new SMTPClient(clientConfig as any);

    await client.send({
      from: `GameTaverns <${smtpFrom}>`,
      to: userEmail,
      subject: `We miss you at GameTaverns, ${displayName}! 🎲`,
      content: "auto",
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
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

Deno.serve(handler);
export default handler;
