import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  thumbnail?: { url: string };
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
  url?: string;
}

interface NotificationPayload {
  library_id: string;
  event_type: "game_added" | "wishlist_vote" | "message_received" | "poll_created" | "poll_closed";
  data: Record<string, unknown>;
}

// Discord embed colors
const COLORS = {
  game_added: 0x22c55e,      // Green
  wishlist_vote: 0xf59e0b,   // Amber
  message_received: 0x3b82f6, // Blue
  poll_created: 0x8b5cf6,    // Purple
  poll_closed: 0x6366f1,     // Indigo
};

function buildEmbed(eventType: string, data: Record<string, unknown>): DiscordEmbed {
  const embed: DiscordEmbed = {
    color: COLORS[eventType as keyof typeof COLORS] || 0x6b7280,
    timestamp: new Date().toISOString(),
  };

  switch (eventType) {
    case "game_added":
      embed.title = "🎲 New Game Added!";
      embed.description = `**${data.title}** has been added to the library.`;
      if (data.image_url) {
        embed.thumbnail = { url: data.image_url as string };
      }
      embed.fields = [];
      if (data.player_count) {
        embed.fields.push({ name: "Players", value: data.player_count as string, inline: true });
      }
      if (data.play_time) {
        embed.fields.push({ name: "Play Time", value: data.play_time as string, inline: true });
      }
      if (data.game_url) {
        embed.url = data.game_url as string;
      }
      break;

    case "wishlist_vote":
      embed.title = "❤️ Wishlist Vote";
      embed.description = `Someone wants to play **${data.game_title}**!`;
      if (data.image_url) {
        embed.thumbnail = { url: data.image_url as string };
      }
      embed.fields = [
        { name: "Total Votes", value: String(data.vote_count || 1), inline: true },
      ];
      if (data.voter_name) {
        embed.fields.push({ name: "Voter", value: data.voter_name as string, inline: true });
      }
      break;

    case "message_received":
      embed.title = "💬 New Message";
      embed.description = `You received a message about **${data.game_title}**.`;
      if (data.sender_name) {
        embed.fields = [
          { name: "From", value: data.sender_name as string, inline: true },
        ];
      }
      embed.footer = { text: "Check your messages in the dashboard" };
      break;

    case "poll_created":
      embed.title = "🗳️ New Poll Created";
      embed.description = `**${data.poll_title}**`;
      embed.fields = [];
      if (data.game_count) {
        embed.fields.push({ name: "Games", value: `${data.game_count} options`, inline: true });
      }
      if (data.poll_type) {
        embed.fields.push({ name: "Type", value: data.poll_type === "game_night" ? "Game Night" : "Quick Vote", inline: true });
      }
      if (data.poll_url) {
        embed.url = data.poll_url as string;
        embed.footer = { text: "Click to vote!" };
      }
      break;

    case "poll_closed":
      embed.title = "📊 Poll Results";
      embed.description = `**${data.poll_title}** has closed!`;
      embed.fields = [];
      if (data.winner_title) {
        embed.fields.push({ name: "🏆 Winner", value: data.winner_title as string, inline: false });
      }
      if (data.total_votes) {
        embed.fields.push({ name: "Total Votes", value: String(data.total_votes), inline: true });
      }
      break;

    default:
      embed.title = "📢 Notification";
      embed.description = JSON.stringify(data);
  }

  return embed;
}

// Helper to send DM via discord-send-dm function
async function sendDM(supabaseUrl: string, userId: string, embed: DiscordEmbed): Promise<void> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/discord-send-dm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, embed }),
    });
    
    if (!response.ok) {
      console.error("DM send failed:", await response.text());
    }
  } catch (error) {
    console.error("DM send error:", error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload: NotificationPayload = await req.json();
    const { library_id, event_type, data } = payload;

    if (!library_id || !event_type) {
      return new Response(
        JSON.stringify({ error: "Missing library_id or event_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch library settings and owner info
    // Fetch library with settings (one-to-one relationship)
    const { data: library, error: libraryError } = await supabase
      .from("libraries")
      .select("owner_id")
      .eq("id", library_id)
      .maybeSingle();

    if (libraryError) {
      console.error("Error fetching library:", libraryError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch library" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!library) {
      return new Response(
        JSON.stringify({ error: "Library not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch settings separately
    const { data: settings } = await supabase
      .from("library_settings")
      .select("discord_webhook_url, discord_notifications")
      .eq("library_id", library_id)
      .maybeSingle();

    const notifications = (settings?.discord_notifications as Record<string, boolean>) || {};

    // Check if this notification type is enabled
    if (notifications[event_type] === false) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Notification type disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the Discord embed
    const embed = buildEmbed(event_type, data);

    // Determine notification destination based on event type
    // Private notifications (message_received) → DM to library owner
    // Public notifications (game_added, wishlist_vote, poll_*) → Webhook
    const isPrivateEvent = event_type === "message_received";

    if (isPrivateEvent) {
      // Send DM to library owner
      await sendDM(supabaseUrl, library.owner_id, embed);
      
      return new Response(
        JSON.stringify({ success: true, method: "dm" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Public events → Send to webhook if configured
    if (!settings?.discord_webhook_url) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "No webhook configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const discordResponse = await fetch(settings.discord_webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      console.error("Discord API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to send Discord notification", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, method: "webhook" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Discord notify error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
