// Note: We keep serve import for compatibility but export handler for self-hosted router
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// AES-GCM decryption using Web Crypto API
async function decryptData(ciphertext: string, keyHex: string): Promise<string> {
  try {
    // Decode base64
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    
    // Extract IV (first 12 bytes) and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
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
      encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error("Decryption error:", error);
    return "[decryption failed]";
  }
}

interface DecryptedMessage {
  id: string;
  game_id: string;
  sender_name: string;
  sender_email: string;
  message: string;
  is_read: boolean;
  created_at: string;
  game?: {
    title: string;
    slug: string | null;
  } | null;
}

// Export handler for self-hosted router
export default async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get library_id from query params (optional - for library owners)
    const url = new URL(req.url);
    const libraryId = url.searchParams.get("library_id");

    // Verify the user
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionKey = Deno.env.get("PII_ENCRYPTION_KEY");

    if (!encryptionKey || encryptionKey.length !== 64) {
      console.error("Missing or invalid PII_ENCRYPTION_KEY");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Use getClaims for proper JWT validation
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("Auth error:", claimsError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is a site admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    const isSiteAdmin = !!roleData;

    // If a library_id is provided, verify user is the owner (or is admin)
    let targetLibraryId: string | null = null;
    
    if (libraryId) {
      // Verify library ownership
      const { data: library, error: libError } = await supabaseAdmin
        .from("libraries")
        .select("id, owner_id")
        .eq("id", libraryId)
        .single();

      if (libError || !library) {
        return new Response(
          JSON.stringify({ success: false, error: "Library not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (library.owner_id !== userId && !isSiteAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: "Access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      targetLibraryId = library.id;
    } else {
      // No library_id provided - check if user owns a library or is admin
      if (!isSiteAdmin) {
        // Check if user owns a library
        const { data: ownedLibrary } = await supabaseAdmin
          .from("libraries")
          .select("id")
          .eq("owner_id", userId)
          .single();

        if (!ownedLibrary) {
          return new Response(
            JSON.stringify({ success: false, error: "No library access" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        targetLibraryId = ownedLibrary.id;
      }
      // If site admin and no library_id, they get all messages (for platform admin view)
    }

    // Build query for messages
    let query = supabaseAdmin
      .from("game_messages")
      .select(`
        id,
        game_id,
        sender_name_encrypted,
        sender_email_encrypted,
        message_encrypted,
        is_read,
        created_at,
        game:games(title, slug, library_id)
      `)
      .order("created_at", { ascending: false });

    // If we have a target library, filter by games in that library
    if (targetLibraryId) {
      // We need to filter by library_id through the games table
      // First get the game IDs for this library
      const { data: libraryGames } = await supabaseAdmin
        .from("games")
        .select("id")
        .eq("library_id", targetLibraryId);

      const gameIds = (libraryGames || []).map(g => g.id);
      
      if (gameIds.length === 0) {
        // No games, no messages
        return new Response(
          JSON.stringify({ success: true, messages: [] }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      query = query.in("game_id", gameIds);
    }

    const { data: messages, error: messagesError } = await query;

    if (messagesError) {
      console.error("Fetch messages error:", messagesError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch messages" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrypt PII fields and message content for each message
    const decryptedMessages: DecryptedMessage[] = await Promise.all(
      (messages || []).map(async (msg: any) => {
        // Decrypt encrypted fields
        const senderName = msg.sender_name_encrypted 
          ? await decryptData(msg.sender_name_encrypted, encryptionKey)
          : "[unknown]";
        const senderEmail = msg.sender_email_encrypted
          ? await decryptData(msg.sender_email_encrypted, encryptionKey)
          : "[unknown]";
        const messageContent = msg.message_encrypted
          ? await decryptData(msg.message_encrypted, encryptionKey)
          : "[no message]";

        // Handle game relation - it comes as an array from Supabase
        const game = Array.isArray(msg.game) ? msg.game[0] : msg.game;

        return {
          id: msg.id,
          game_id: msg.game_id,
          sender_name: senderName,
          sender_email: senderEmail,
          message: messageContent,
          is_read: msg.is_read,
          created_at: msg.created_at,
          game: game ? { title: game.title, slug: game.slug } : null,
        };
      })
    );

    return new Response(
      JSON.stringify({ success: true, messages: decryptedMessages }),
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
