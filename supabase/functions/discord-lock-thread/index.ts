const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DISCORD_API = "https://discord.com/api/v10";

/**
 * Lock and archive a Discord forum thread (channel).
 * Posts a closing message first, then locks + archives.
 */
async function lockDiscordThread(
  threadId: string
): Promise<{ success: boolean; error?: string }> {
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!botToken) {
    return { success: false, error: "DISCORD_BOT_TOKEN not configured" };
  }

  const headers = {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  };

  console.log("Locking Discord thread:", threadId);

  // 1. First, unarchive the thread if it was auto-archived (so we can post)
  await fetch(`${DISCORD_API}/channels/${threadId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ archived: false }),
  }).catch((_e: unknown) => {});

  // 2. Post the closing message while the thread is still open
  const msgRes = await fetch(`${DISCORD_API}/channels/${threadId}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      embeds: [{
        title: "✅ Resolved",
        description: "This feedback item has been marked as resolved. The thread is now locked.",
        color: 0x22c55e,
        timestamp: new Date().toISOString(),
      }],
    }),
  });

  if (!msgRes.ok) {
    const errText = await msgRes.text();
    console.warn("Failed to post closing message:", msgRes.status, errText);
    // 404 = thread deleted, treat as success
    if (msgRes.status === 404) {
      return { success: true };
    }
  }

  // 3. Now lock and archive the thread
  const response = await fetch(`${DISCORD_API}/channels/${threadId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      archived: true,
      locked: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Discord thread lock failed:", response.status, errorText);

    if (response.status === 404) {
      return { success: true };
    }

    return { success: false, error: `Discord API error: ${response.status} - ${errorText}` };
  }

  console.log("Discord thread locked successfully");
  return { success: true };
}

/**
 * Post a note/message to a Discord forum thread.
 */
async function postToThread(
  threadId: string,
  authorName: string,
  content: string,
  noteType: string
): Promise<{ success: boolean; error?: string }> {
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!botToken) {
    return { success: false, error: "DISCORD_BOT_TOKEN not configured" };
  }

  const headers = {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  };

  // Unarchive first if needed
  await fetch(`${DISCORD_API}/channels/${threadId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ archived: false }),
  }).catch((_e: unknown) => {});

  const isReply = noteType === "reply";
  const embed = {
    title: isReply ? "💬 Staff Reply" : "📝 Internal Note",
    description: content.substring(0, 4000),
    color: isReply ? 0x3b82f6 : 0x6b7280,
    footer: { text: `By ${authorName}` },
    timestamp: new Date().toISOString(),
  };

  const response = await fetch(`${DISCORD_API}/channels/${threadId}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ embeds: [embed] }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Discord thread message failed:", response.status, errorText);
    return { success: false, error: errorText };
  }

  return { success: true };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, thread_id, author_name, content, note_type } = body;

    if (!thread_id) {
      return new Response(
        JSON.stringify({ error: "Missing required field: thread_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: { success: boolean; error?: string };

    if (action === "post_note") {
      result = await postToThread(thread_id, author_name || "Staff", content || "", note_type || "internal");
    } else {
      // Default action: lock
      result = await lockDiscordThread(thread_id);
    }

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
