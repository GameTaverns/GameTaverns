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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const encryptionKey = Deno.env.get("PII_ENCRYPTION_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !encryptionKey) {
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

    // Verify the user is the library owner for this message's game
    const { data: message, error: msgError } = await supabaseAdmin
      .from("game_messages")
      .select(`
        id,
        game_id,
        sender_user_id,
        games!inner (
          library_id,
          title,
          libraries!inner (
            owner_id
          )
        )
      `)
      .eq("id", message_id)
      .single();

    if (msgError || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Message not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const libraryOwnerId = (message.games as any)?.libraries?.owner_id;
    if (libraryOwnerId !== user.id) {
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
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to send reply" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send Discord DM to the inquirer if they have Discord linked
    const senderUserId = message.sender_user_id;
    const gameTitle = (message.games as any)?.title;
    
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
        console.error("Discord DM notify failed:", err);
        // Don't fail the request if notification fails
      }
    }

    console.log(`Reply sent for message ${message_id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
