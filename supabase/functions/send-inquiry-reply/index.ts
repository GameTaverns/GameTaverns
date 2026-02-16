import { createClient } from "npm:@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// AES-GCM encryption using Web Crypto API
async function encryptData(plaintext: string, keyHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

export default async function handler(req: Request): Promise<Response> {
  console.log("[send-inquiry-reply] Handler invoked");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const encryptionKey = Deno.env.get("PII_ENCRYPTION_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !encryptionKey) {
      console.error("[send-inquiry-reply] Missing env vars");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth token
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[send-inquiry-reply] User:", user.id);

    // Rate limit: max 20 replies per user per hour
    const rl = checkRateLimit("send-inquiry-reply", user.id, { maxRequests: 20, windowMs: 60 * 60_000 });
    if (!rl.allowed) {
      return rateLimitResponse(rl, corsHeaders, "Too many replies. Please try again later.");
    }

    const { message_id, reply_text } = await req.json();

    if (!message_id || !reply_text) {
      return new Response(
        JSON.stringify({ success: false, error: "Message ID and reply text required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (reply_text.trim().length === 0 || reply_text.length > 2000) {
      return new Response(
        JSON.stringify({ success: false, error: "Reply must be 1-2000 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user owns this inquiry
    const { data: message, error: msgError } = await supabaseAdmin
      .from("game_messages")
      .select("id, sender_user_id, game_id")
      .eq("id", message_id)
      .maybeSingle();

    if (msgError || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Message not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (message.sender_user_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: "You can only reply to your own inquiries" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Encrypt and insert reply
    const encryptedReply = await encryptData(reply_text.trim(), encryptionKey);

    const insertRes = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/game_message_replies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        message_id,
        reply_text_encrypted: encryptedReply,
        replied_by: user.id,
      }),
    });

    if (!insertRes.ok) {
      const body = await insertRes.text();
      console.error("[send-inquiry-reply] Insert failed:", insertRes.status, body);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to send reply" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Notify library owner via Discord DM
    const { data: game } = await supabaseAdmin
      .from("games")
      .select("title, library_id")
      .eq("id", message.game_id)
      .maybeSingle();

    if (game?.library_id) {
      const { data: library } = await supabaseAdmin
        .from("libraries")
        .select("owner_id")
        .eq("id", game.library_id)
        .maybeSingle();

      if (library?.owner_id) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/discord-send-dm`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              user_id: library.owner_id,
              embed: {
                title: "💬 New Reply to Inquiry",
                description: `A buyer replied to their inquiry about **${game.title}**!`,
                color: 0x10b981,
                footer: { text: "Check your messages to view the reply" },
                timestamp: new Date().toISOString(),
              },
            }),
          });
        } catch (err) {
          console.error("[send-inquiry-reply] Discord notify failed:", err);
        }
      }
    }

    console.log("[send-inquiry-reply] Reply sent for message:", message_id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[send-inquiry-reply] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
