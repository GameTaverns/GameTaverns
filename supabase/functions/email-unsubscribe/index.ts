import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function generateToken(userId: string, secret: string): string {
  return createHmac("sha256", secret).update(userId).digest("hex");
}

function verifyToken(userId: string, token: string, secret: string): boolean {
  const expected = generateToken(userId, secret);
  return expected === token;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const secret = Deno.env.get("PII_ENCRYPTION_KEY") || serviceKey;
    const supabase = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const userId = url.searchParams.get("uid");
    const token = url.searchParams.get("token");

    if (!userId || !token) {
      return new Response(renderPage("Invalid Link", "This unsubscribe link is missing required parameters."), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (!verifyToken(userId, token, secret)) {
      return new Response(renderPage("Invalid Link", "This unsubscribe link is invalid or has expired."), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Set opt-out flag
    const { error } = await supabase
      .from("user_profiles")
      .update({ marketing_emails_opted_out: true })
      .eq("user_id", userId);

    if (error) {
      console.error("Unsubscribe error:", error);
      return new Response(renderPage("Error", "Something went wrong. Please try again or contact support."), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Audit log + email events
    await Promise.all([
      supabase.from("audit_log").insert({
        user_id: userId,
        action: "marketing_email_unsubscribed",
        details: { method: "one_click_link" },
      }),
      supabase.from("reengagement_email_events").insert({
        user_id: userId,
        event_type: "unsubscribed",
        metadata: { method: "one_click_link" },
      }),
    ]);

    return new Response(
      renderPage(
        "Unsubscribed",
        "You've been successfully unsubscribed from GameTaverns marketing emails. You can re-enable these emails anytime in your account settings."
      ),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      }
    );
  } catch (err: any) {
    console.error("Unsubscribe error:", err);
    return new Response(renderPage("Error", err.message), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  }
};

function renderPage(title: string, message: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — GameTaverns</title>
<style>
  body { margin:0; padding:0; background:#e8dcc8; font-family:Georgia,'Times New Roman',serif; display:flex; align-items:center; justify-content:center; min-height:100vh; }
  .card { background:#f5eed9; border:1px solid #d4c4a0; border-radius:8px; padding:40px; max-width:480px; text-align:center; box-shadow:0 2px 8px rgba(60,40,20,0.15); }
  h1 { color:#3d2b1f; font-size:24px; margin:0 0 16px; }
  p { color:#5c4a3a; font-size:15px; line-height:1.6; margin:0 0 24px; }
  a { display:inline-block; background:#556b2f; color:#f5eed9; padding:10px 24px; border-radius:6px; text-decoration:none; font-size:14px; }
</style></head><body>
<div class="card">
  <h1>${title}</h1>
  <p>${message}</p>
  <a href="https://gametaverns.com">Visit GameTaverns →</a>
</div>
</body></html>`;
}

export default handler;

if (import.meta.main) {
  Deno.serve(handler);
}
