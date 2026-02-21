// Sends a game sale inquiry as a DM to the library owner
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-native-app-token",
};

const URL_REGEX = /(?:https?:\/\/|www\.)[^\s]+|[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\/[^\s]*)?/gi;

export default async function handler(req: Request): Promise<Response> {
  console.log("[send-message] Handler invoked, version: 2026-02-21-dm");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { game_id, sender_name, message } = body;

    if (!game_id || !sender_name || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "All fields are required" }),
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

    // Parallelize auth check and game lookup for speed
    const authHeader = req.headers.get("authorization");
    const authPromise = (async () => {
      if (!authHeader?.startsWith("Bearer ")) return null;
      const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.substring(7));
      return user?.id || null;
    })();

    const gamePromise = supabaseAdmin
      .from("games")
      .select("id, is_for_sale, title, library_id, libraries!inner(owner_id)")
      .eq("id", game_id)
      .single();

    const [senderUserId, { data: game, error: gameError }] = await Promise.all([authPromise, gamePromise]);

    if (!senderUserId) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required to send messages" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Send Discord DM notification only (fire-and-forget)
    try {
      if (game.library_id) {
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
      JSON.stringify({ success: true, message: "Message sent successfully", recipient_id: libraryOwnerId }),
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
