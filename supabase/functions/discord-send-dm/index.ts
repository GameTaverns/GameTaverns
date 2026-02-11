import { createClient } from "npm:@supabase/supabase-js@2";

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

interface DMPayload {
  user_id: string; // Our app's user ID (not Discord ID)
  embed: DiscordEmbed;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const payload: DMPayload = await req.json();
    const { user_id, embed } = payload;

    if (!user_id || !embed) {
      return new Response(
        JSON.stringify({ error: "Missing user_id or embed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("discord_user_id")
      .eq("user_id", user_id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch user profile" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile?.discord_user_id) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "No Discord account linked" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const channelResponse = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${botToken}`,
      },
      body: JSON.stringify({
        recipient_id: profile.discord_user_id,
      }),
    });

    if (!channelResponse.ok) {
      const errorText = await channelResponse.text();
      console.error("Discord DM channel error:", errorText);
      
      if (channelResponse.status === 403) {
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "User has DMs disabled" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to create DM channel" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const channel = await channelResponse.json();

    const messageResponse = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${botToken}`,
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });

    if (!messageResponse.ok) {
      const errorText = await messageResponse.text();
      console.error("Discord message error:", errorText);

      try {
        const parsed = JSON.parse(errorText) as { code?: number; message?: string };
        if (parsed?.code === 50007) {
          return new Response(
            JSON.stringify({
              success: true,
              skipped: true,
              reason: "Cannot send messages to this user (Discord code 50007)",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch {
        // ignore parse errors
      }

      return new Response(
        JSON.stringify({ error: "Failed to send DM" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`DM sent to Discord user ${profile.discord_user_id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Discord DM error:", error);
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
