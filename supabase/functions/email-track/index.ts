import { createClient } from "npm:@supabase/supabase-js@2";

// 1x1 transparent GIF
const PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), c => c.charCodeAt(0));

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const type = url.searchParams.get("t"); // "open" or "click"
    const userId = url.searchParams.get("uid");
    const redirect = url.searchParams.get("r"); // redirect URL for clicks

    if (userId && (type === "open" || type === "click")) {
      // Log the event — fire and forget
      await supabase.from("reengagement_email_events").insert({
        user_id: userId,
        event_type: type === "open" ? "opened" : "clicked",
        metadata: redirect ? { url: redirect } : {},
      });
    }

    if (type === "click" && redirect) {
      // Redirect to the actual URL
      return new Response(null, {
        status: 302,
        headers: { Location: redirect },
      });
    }

    // Return tracking pixel for opens
    return new Response(PIXEL, {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (err) {
    console.error("Email track error:", err);
    // Always return pixel to avoid broken images
    return new Response(PIXEL, {
      headers: { "Content-Type": "image/gif" },
    });
  }
};

export default handler;

if (import.meta.main) {
  Deno.serve(handler);
}
