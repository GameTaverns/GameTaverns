// Sends a game sale inquiry as a DM to the library owner
import { createClient } from "npm:@supabase/supabase-js@2";
import { withLogging } from "../_shared/system-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-native-app-token",
};

// Secret token baked into the Android APK — allows native apps to bypass Turnstile.
const NATIVE_APP_SECRET = "gt-android-2026-a7f3k9m2p4x8q1n5";

// Verify reCAPTCHA v3 token with Google
async function verifyRecaptchaToken(token: string, ip: string, req?: Request): Promise<boolean> {
  if (token === "RECAPTCHA_BYPASS_TOKEN") {
    const appSecret = req?.headers.get("x-native-app-token");
    if (appSecret === NATIVE_APP_SECRET) {
      console.log("Native app secret validated — reCAPTCHA bypass accepted");
      return true;
    }
    console.warn("RECAPTCHA_BYPASS_TOKEN used without valid x-native-app-token header — rejected");
    return false;
  }

  if (token.startsWith("RECAPTCHA_") && token !== "RECAPTCHA_BYPASS_TOKEN") {
    console.warn("reCAPTCHA client-side failure token:", token, "— failing open");
    return true;
  }

  const secretKey = Deno.env.get("RECAPTCHA_SECRET_KEY");
  if (!secretKey) {
    console.warn("Missing RECAPTCHA_SECRET_KEY — skipping verification (fail open)");
    return true;
  }

  try {
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: secretKey, response: token, remoteip: ip }),
    });
    const result = await response.json();
    if (!result.success) { console.warn("reCAPTCHA failed:", result["error-codes"]); return false; }
    if (result.score !== undefined && result.score < 0.3) { console.warn("reCAPTCHA score too low:", result.score); return false; }
    return true;
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return true;
  }
}

const URL_REGEX = /(?:https?:\/\/|www\.)[^\s]+|[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\/[^\s]*)?/gi;

export default async function handler(req: Request): Promise<Response> {
  console.log("[send-message] Handler invoked, version: 2026-02-21-dm");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip")
      || "unknown";

    const body = await req.json();
    const { game_id, sender_name, message, recaptcha_token } = body;

    if (!game_id || !sender_name || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "All fields are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!recaptcha_token) {
      return new Response(
        JSON.stringify({ success: false, error: "Please complete the CAPTCHA verification" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isCaptchaValid = await verifyRecaptchaToken(recaptcha_token, clientIp, req);
    if (!isCaptchaValid) {
      return new Response(
        JSON.stringify({ success: false, error: "CAPTCHA verification failed. Please try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (sender_name.trim().length === 0 || sender_name.length > 100) {
      return new Response(
        JSON.stringify({ success: false, error: "Name must be between 1 and 100 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (message.trim().length === 0 || message.length > 2000) {
      return new Response(
        JSON.stringify({ success: false, error: "Message must be between 1 and 2000 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (URL_REGEX.test(message)) {
      return new Response(
        JSON.stringify({ success: false, error: "Links are not allowed in messages" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(game_id)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid game ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get the sender's user ID from auth token
    let senderUserId: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      senderUserId = user?.id || null;
    }

    if (!senderUserId) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required to send messages" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the game exists and is for sale, and get the library owner
    const { data: game, error: gameError } = await supabaseAdmin
      .from("games")
      .select("id, is_for_sale, title, library_id, libraries!inner(owner_id)")
      .eq("id", game_id)
      .single();

    if (gameError || !game) {
      return new Response(
        JSON.stringify({ success: false, error: "Game not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!game.is_for_sale) {
      return new Response(
        JSON.stringify({ success: false, error: "This game is not available for sale" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const libraryOwnerId = (game.libraries as any)?.owner_id;
    if (!libraryOwnerId) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not determine game owner" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Don't allow messaging yourself
    if (senderUserId === libraryOwnerId) {
      return new Response(
        JSON.stringify({ success: false, error: "You cannot send an inquiry for your own game" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prefix the message with game context
    const prefixedContent = `Re: ${game.title} — ${message.trim()}`;

    // Insert as a direct message to the library owner
    const { error: insertError } = await supabaseAdmin
      .from("direct_messages")
      .insert({
        sender_id: senderUserId,
        recipient_id: libraryOwnerId,
        content: prefixedContent,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to send message. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Game inquiry DM sent for "${game.title}" by user ${senderUserId} to owner ${libraryOwnerId}`);

    // Send Discord notifications (fire-and-forget)
    try {
      if (game.library_id) {
        fetch(`${supabaseUrl}/functions/v1/discord-notify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            library_id: game.library_id,
            event_type: "message_received",
            data: { game_title: game.title, sender_name: sender_name.trim() },
          }),
        }).catch(err => console.error("Discord webhook notify failed:", err));

        fetch(`${supabaseUrl}/functions/v1/discord-send-dm`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            user_id: libraryOwnerId,
            embed: {
              title: "📬 New Game Inquiry",
              description: `Someone is interested in **${game.title}**!`,
              color: 0x22c55e,
              fields: [
                { name: "From", value: sender_name.trim(), inline: true },
                { name: "Game", value: game.title, inline: true },
              ],
              footer: { text: "Check your Direct Messages to view and reply" },
              timestamp: new Date().toISOString(),
            },
          }),
        }).catch(err => console.error("Discord DM notify failed:", err));
      }
    } catch (notifyError) {
      console.error("Discord notification error:", notifyError);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Message sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
