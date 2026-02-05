import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ForumPostPayload {
  library_id: string;
  title: string;
  description?: string;
  event_date?: string;
  event_location?: string;
  poll_url?: string;
  event_type: "poll" | "standalone";
  event_id?: string; // For standalone events, to save thread_id back
}

const DISCORD_API = "https://discord.com/api/v10";

/**
 * Create a forum thread with an event announcement
 */
async function createForumThread(
  channelId: string,
  event: {
    title: string;
    description?: string;
    event_date?: string;
    event_location?: string;
    poll_url?: string;
    event_type: "poll" | "standalone";
  }
): Promise<{ success: boolean; thread_id?: string; error?: string }> {
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!botToken) {
    return { success: false, error: "DISCORD_BOT_TOKEN not configured" };
  }

  // Build the embed for the forum post
  const embed: Record<string, unknown> = {
    title: event.title,
    color: event.event_type === "poll" ? 0x8b5cf6 : 0x06b6d4, // Purple for polls, Cyan for standalone
    timestamp: new Date().toISOString(),
  };

  // Build description
  let description = event.description || "";
  if (event.poll_url) {
    description += description ? `\n\n🗳️ **Vote here:** ${event.poll_url}` : `🗳️ **Vote here:** ${event.poll_url}`;
  }
  if (description) {
    embed.description = description;
  }

  // Add fields
  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
  
  if (event.event_date) {
    const eventDate = new Date(event.event_date);
    fields.push({
      name: "📅 Date & Time",
      value: eventDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      inline: true,
    });
  }

  if (event.event_location) {
    fields.push({
      name: "📍 Location",
      value: event.event_location,
      inline: true,
    });
  }

  if (fields.length > 0) {
    embed.fields = fields;
  }

  // Create the forum thread with a starter message
  const payload = {
    name: event.title.substring(0, 100), // Discord thread names max 100 chars
    message: {
      embeds: [embed],
    },
    // Auto archive after 1 day of inactivity
    auto_archive_duration: 1440,
  };

  console.log("Creating forum thread in channel:", channelId);
  console.log("Payload:", JSON.stringify(payload));

  const response = await fetch(`${DISCORD_API}/channels/${channelId}/threads`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Discord forum thread creation failed:", response.status, errorText);
    return { success: false, error: `Discord API error: ${response.status} - ${errorText}` };
  }

  const thread = await response.json();
  console.log("Forum thread created:", thread.id);
  
  return { success: true, thread_id: thread.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload: ForumPostPayload = await req.json();
    const { library_id, title, description, event_date, event_location, poll_url, event_type, event_id } = payload;

    if (!library_id || !title) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: library_id, title" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get library settings to find forum channel ID
    const { data: settings, error: settingsError } = await supabase
      .from("library_settings")
      .select("discord_events_channel_id, discord_notifications")
      .eq("library_id", library_id)
      .maybeSingle();

    if (settingsError) {
      console.error("Error fetching library settings:", settingsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch library settings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings?.discord_events_channel_id) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "No events forum channel configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if notifications are enabled
    const notifications = (settings.discord_notifications as Record<string, boolean>) || {};
    if (event_type === "poll" && notifications.poll_created === false) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Poll notifications disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the forum thread
    const result = await createForumThread(settings.discord_events_channel_id, {
      title,
      description,
      event_date,
      event_location,
      poll_url,
      event_type,
    });

    if (!result.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error || "Failed to create forum thread. Ensure bot has permissions in the forum channel." 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If this is a standalone event, save the thread_id back to the event
    if (event_type === "standalone" && event_id && result.thread_id) {
      const { error: updateError } = await supabase
        .from("library_events")
        .update({ discord_thread_id: result.thread_id })
        .eq("id", event_id);
      
      if (updateError) {
        console.error("Failed to save thread ID to event:", updateError);
        // Don't fail the request, thread was created successfully
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        thread_id: result.thread_id,
        event_id: payload.event_id || null
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Discord forum post error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
