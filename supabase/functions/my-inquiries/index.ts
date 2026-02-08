import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// AES-GCM decryption using Web Crypto API
async function decryptData(encryptedBase64: string, keyHex: string): Promise<string> {
  try {
    // Convert base64 to bytes
    const combined = new Uint8Array(
      atob(encryptedBase64).split("").map(c => c.charCodeAt(0))
    );
    
    // Extract IV (first 12 bytes) and ciphertext
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    
    // Convert hex key to bytes
    const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    
    // Import the key
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error("Decryption error:", error);
    return "[Unable to decrypt]";
  }
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

    const body = await req.json().catch(() => ({}));

    // If just counting unread replies
    if (body.countOnly) {
      const { data: messages } = await supabaseAdmin
        .from("game_messages")
        .select("id")
        .eq("sender_user_id", user.id);

      if (!messages || messages.length === 0) {
        return new Response(
          JSON.stringify({ success: true, unreadCount: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const messageIds = messages.map(m => m.id);
      
      // Count replies to user's messages that they haven't seen
      // For now, count all replies (could add read tracking later)
      const { count } = await supabaseAdmin
        .from("game_message_replies")
        .select("*", { count: "exact", head: true })
        .in("message_id", messageIds);

      return new Response(
        JSON.stringify({ success: true, unreadCount: count || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user's inquiries with game info
    const { data: messages, error: queryError } = await supabaseAdmin
      .from("game_messages")
      .select(`
        id,
        game_id,
        sender_name_encrypted,
        message_encrypted,
        is_read,
        created_at,
        games (
          title,
          slug,
          library_id
        )
      `)
      .eq("sender_user_id", user.id)
      .order("created_at", { ascending: false });

    if (queryError) {
      console.error("Query error:", queryError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch inquiries" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch replies for all messages
    const messageIds = messages?.map(m => m.id) || [];
    let repliesMap: Record<string, any[]> = {};

    if (messageIds.length > 0) {
      const { data: replies } = await supabaseAdmin
        .from("game_message_replies")
        .select("id, message_id, reply_text_encrypted, created_at")
        .in("message_id", messageIds)
        .order("created_at", { ascending: true });

      if (replies) {
        for (const reply of replies) {
          if (!repliesMap[reply.message_id]) {
            repliesMap[reply.message_id] = [];
          }
          repliesMap[reply.message_id].push({
            id: reply.id,
            reply_text: await decryptData(reply.reply_text_encrypted, encryptionKey),
            created_at: reply.created_at,
          });
        }
      }
    }

    // Decrypt and format the inquiries
    const inquiries = await Promise.all(
      (messages || []).map(async (msg: any) => ({
        id: msg.id,
        game_id: msg.game_id,
        sender_name: await decryptData(msg.sender_name_encrypted, encryptionKey),
        message: await decryptData(msg.message_encrypted, encryptionKey),
        is_read: msg.is_read,
        created_at: msg.created_at,
        game: msg.games,
        replies: repliesMap[msg.id] || [],
      }))
    );

    return new Response(
      JSON.stringify({ success: true, inquiries }),
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
