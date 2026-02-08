import { createClient } from "npm:@supabase/supabase-js@2";

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
  console.log("[reply-to-inquiry] Handler invoked, version: 2026-02-08-v1");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const encryptionKey = Deno.env.get("PII_ENCRYPTION_KEY");

    if (!supabaseUrl) {
      console.error("[reply-to-inquiry] Missing SUPABASE_URL");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error: missing URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!supabaseServiceKey) {
      console.error("[reply-to-inquiry] Missing SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error: missing service key" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!encryptionKey) {
      console.error("[reply-to-inquiry] Missing PII_ENCRYPTION_KEY");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error: missing encryption key" }),
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
      console.error("[reply-to-inquiry] Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[reply-to-inquiry] User authenticated:", user.id);

    const { message_id, reply_text } = await req.json();

    // Validate input
    if (!message_id || !reply_text) {
      return new Response(
        JSON.stringify({ success: false, error: "Message ID and reply text are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (reply_text.trim().length === 0 || reply_text.length > 2000) {
      return new Response(
        JSON.stringify({ success: false, error: "Reply must be between 1 and 2000 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch message without nested joins (self-hosted PostgREST compatibility)
    const { data: message, error: msgError } = await supabaseAdmin
      .from("game_messages")
      .select("id, game_id, sender_user_id")
      .eq("id", message_id)
      .maybeSingle();

    if (msgError) {
      console.error("[reply-to-inquiry] Message query error:", msgError.message);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch message" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!message) {
      return new Response(
        JSON.stringify({ success: false, error: "Message not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch game info separately
    const { data: game, error: gameError } = await supabaseAdmin
      .from("games")
      .select("id, title, library_id")
      .eq("id", message.game_id)
      .maybeSingle();

    if (gameError || !game) {
      console.error("[reply-to-inquiry] Game query error:", gameError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Game not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch library to verify ownership
    const { data: library, error: libError } = await supabaseAdmin
      .from("libraries")
      .select("id, owner_id")
      .eq("id", game.library_id)
      .maybeSingle();

    if (libError || !library) {
      console.error("[reply-to-inquiry] Library query error:", libError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Library not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (library.owner_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: "You can only reply to messages about your games" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Encrypt the reply
    const encryptedReply = await encryptData(reply_text.trim(), encryptionKey);

    // Insert the reply
    const { error: insertError } = await supabaseAdmin
      .from("game_message_replies")
      .insert({
        message_id,
        reply_text_encrypted: encryptedReply,
        replied_by: user.id,
      });

    if (insertError) {
      // NOTE: PostgrestError often has non-enumerable properties, so JSON.stringify can show "{}".
      // Log multiple representations so we can see the real failure (grants, FK, etc.).
      try {
        console.error("[reply-to-inquiry] Insert error direct:", insertError);
        console.error("[reply-to-inquiry] Insert error keys:", Object.keys(insertError as any));
        console.error("[reply-to-inquiry] Insert error props:", Object.getOwnPropertyNames(insertError as any));
        console.error("[reply-to-inquiry] Insert error raw JSON:", JSON.stringify(insertError, null, 2));
      } catch (e) {
        console.error("[reply-to-inquiry] Failed to stringify insert error:", e);
      }

      const anyErr = insertError as any;
      return new Response(
        JSON.stringify({
          success: false,
          error: anyErr?.message || anyErr?.details || anyErr?.hint || String(insertError) || "Failed to send reply",
          code: anyErr?.code || null,
          details: anyErr?.details || null,
          hint: anyErr?.hint || null,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send Discord DM to the inquirer if they have Discord linked
    const senderUserId = message.sender_user_id;
    const gameTitle = game.title;
    
    if (senderUserId) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/discord-send-dm`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            user_id: senderUserId,
            embed: {
              title: "💬 Reply to Your Inquiry",
              description: `The seller responded to your inquiry about **${gameTitle}**!`,
              color: 0x3b82f6, // Blue
              fields: [
                { name: "Game", value: gameTitle, inline: true },
              ],
              footer: { text: "Check your dashboard to view the full reply" },
              timestamp: new Date().toISOString(),
            },
          }),
        });
      } catch (err) {
        console.error("[reply-to-inquiry] Discord DM notify failed:", err);
        // Don't fail the request if notification fails
      }
    }

    console.log(`[reply-to-inquiry] Reply sent for message ${message_id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[reply-to-inquiry] Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
