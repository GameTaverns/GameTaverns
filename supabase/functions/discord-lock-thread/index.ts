import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DISCORD_API = "https://discord.com/api/v10";

/**
 * Lock and archive a Discord forum thread (channel).
 * PATCH /channels/{id} with { locked: true, archived: true }
 */
async function lockDiscordThread(
  threadId: string
): Promise<{ success: boolean; error?: string }> {
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!botToken) {
    return { success: false, error: "DISCORD_BOT_TOKEN not configured" };
  }

  console.log("Locking Discord thread:", threadId);

  const response = await fetch(`${DISCORD_API}/channels/${threadId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      archived: true,
      locked: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Discord thread lock failed:", response.status, errorText);

    // 404 means thread already deleted — treat as success
    if (response.status === 404) {
      return { success: true };
    }

    return { success: false, error: `Discord API error: ${response.status} - ${errorText}` };
  }

  // Optionally post a closing message before archiving
  const botToken2 = Deno.env.get("DISCORD_BOT_TOKEN");
  await fetch(`${DISCORD_API}/channels/${threadId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken2}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      embeds: [{
        title: "✅ Resolved",
        description: "This feedback item has been marked as resolved. The thread is now locked.",
        color: 0x22c55e, // green-500
        timestamp: new Date().toISOString(),
      }],
    }),
  }).catch((e: unknown) => console.warn("Failed to post closing message:", e));

  console.log("Discord thread locked successfully");
  return { success: true };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { thread_id } = await req.json();

    if (!thread_id) {
      return new Response(
        JSON.stringify({ error: "Missing required field: thread_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await lockDiscordThread(thread_id);

    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Discord lock thread error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

export default handler;

if (import.meta.main) {
  Deno.serve(handler);
}
