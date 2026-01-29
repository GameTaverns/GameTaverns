import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DeleteThreadPayload {
  library_id: string;
  thread_id: string;
}

const DISCORD_API = "https://discord.com/api/v10";

/**
 * Delete a Discord channel/thread
 */
async function deleteDiscordThread(
  threadId: string
): Promise<{ success: boolean; error?: string }> {
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!botToken) {
    return { success: false, error: "DISCORD_BOT_TOKEN not configured" };
  }

  console.log("Deleting Discord thread:", threadId);

  const response = await fetch(`${DISCORD_API}/channels/${threadId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bot ${botToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Discord thread deletion failed:", response.status, errorText);
    
    // 404 means already deleted - treat as success
    if (response.status === 404) {
      return { success: true };
    }
    
    return { success: false, error: `Discord API error: ${response.status} - ${errorText}` };
  }

  console.log("Discord thread deleted successfully");
  return { success: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload: DeleteThreadPayload = await req.json();
    const { library_id, thread_id } = payload;

    if (!library_id || !thread_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: library_id, thread_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the library exists (basic validation)
    const { data: library, error: libError } = await supabase
      .from("libraries")
      .select("id")
      .eq("id", library_id)
      .maybeSingle();

    if (libError || !library) {
      return new Response(
        JSON.stringify({ error: "Library not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete the Discord thread
    const result = await deleteDiscordThread(thread_id);

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
    console.error("Discord delete thread error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
