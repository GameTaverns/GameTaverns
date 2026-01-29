import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateEventPayload {
  library_id: string;
  poll_id: string;
  name: string;
  description?: string;
  scheduled_start_time: string; // ISO 8601 timestamp
  scheduled_end_time?: string;
  location?: string;
  poll_url?: string;
}

interface DiscordScheduledEvent {
  id: string;
  guild_id: string;
  name: string;
  scheduled_start_time: string;
}

// Discord API base
const DISCORD_API = "https://discord.com/api/v10";

/**
 * Get guild_id from a Discord webhook URL by fetching webhook info
 */
async function getGuildIdFromWebhook(webhookUrl: string): Promise<string | null> {
  try {
    // Extract webhook ID from URL: https://discord.com/api/webhooks/{id}/{token}
    const match = webhookUrl.match(/webhooks\/(\d+)\//);
    if (!match) return null;

    const webhookId = match[1];
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    if (!botToken) return null;

    const response = await fetch(`${DISCORD_API}/webhooks/${webhookId}`, {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch webhook info:", await response.text());
      return null;
    }

    const webhook = await response.json();
    return webhook.guild_id || null;
  } catch (error) {
    console.error("Error getting guild ID:", error);
    return null;
  }
}

/**
 * Create a Discord Scheduled Event
 */
async function createDiscordEvent(
  guildId: string,
  event: {
    name: string;
    description?: string;
    scheduled_start_time: string;
    scheduled_end_time?: string;
    location?: string;
  }
): Promise<DiscordScheduledEvent | null> {
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!botToken) {
    console.error("DISCORD_BOT_TOKEN not configured");
    return null;
  }

  // Entity type 3 = External (location-based event, not voice channel)
  const payload = {
    name: event.name,
    privacy_level: 2, // GUILD_ONLY
    scheduled_start_time: event.scheduled_start_time,
    scheduled_end_time: event.scheduled_end_time || new Date(
      new Date(event.scheduled_start_time).getTime() + 3 * 60 * 60 * 1000 // Default 3 hours
    ).toISOString(),
    description: event.description || undefined,
    entity_type: 3, // External
    entity_metadata: {
      location: event.location || "Game Night Location TBD",
    },
  };

  console.log("Creating Discord event:", JSON.stringify(payload));

  const response = await fetch(`${DISCORD_API}/guilds/${guildId}/scheduled-events`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Discord event creation failed:", response.status, errorText);
    return null;
  }

  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload: CreateEventPayload = await req.json();
    const { library_id, poll_id, name, description, scheduled_start_time, scheduled_end_time, location, poll_url } = payload;

    if (!library_id || !poll_id || !name || !scheduled_start_time) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: library_id, poll_id, name, scheduled_start_time" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get library settings to find webhook URL
    const { data: settings, error: settingsError } = await supabase
      .from("library_settings")
      .select("discord_webhook_url, discord_notifications")
      .eq("library_id", library_id)
      .maybeSingle();

    if (settingsError) {
      console.error("Error fetching library settings:", settingsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch library settings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings?.discord_webhook_url) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "No webhook configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if poll_created notifications are enabled
    const notifications = (settings.discord_notifications as Record<string, boolean>) || {};
    if (notifications.poll_created === false) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Poll notifications disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get guild ID from webhook
    const guildId = await getGuildIdFromWebhook(settings.discord_webhook_url);
    if (!guildId) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Could not determine Discord server from webhook" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build event description with poll link
    let eventDescription = description || "";
    if (poll_url) {
      eventDescription += eventDescription ? `\n\n🗳️ Vote here: ${poll_url}` : `🗳️ Vote here: ${poll_url}`;
    }

    // Create the Discord scheduled event
    const discordEvent = await createDiscordEvent(guildId, {
      name,
      description: eventDescription,
      scheduled_start_time,
      scheduled_end_time,
      location,
    });

    if (!discordEvent) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to create Discord event. Ensure bot has 'Manage Events' permission." 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Discord event created:", discordEvent.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        event_id: discordEvent.id,
        guild_id: guildId 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Discord create-event error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
