import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // Contains user_id encrypted or as JWT
    const error = url.searchParams.get("error");

    if (error) {
      console.error("Discord OAuth error:", error);
      return redirectWithError("Discord authorization was denied");
    }

    if (!code || !state) {
      return redirectWithError("Missing authorization code or state");
    }

    const clientId = Deno.env.get("DISCORD_CLIENT_ID")!;
    const clientSecret = Deno.env.get("DISCORD_CLIENT_SECRET")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Parse state to get user_id (state is base64 encoded JSON with user_id)
    let userId: string;
    let returnUrl: string;
    try {
      const stateData = JSON.parse(atob(state));
      userId = stateData.user_id;
      returnUrl = stateData.return_url || "/settings";
    } catch {
      return redirectWithError("Invalid state parameter");
    }

    if (!userId) {
      return redirectWithError("Missing user ID in state");
    }

    // Exchange code for access token
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: `${supabaseUrl}/functions/v1/discord-oauth-callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Discord token error:", errorText);
      return redirectWithError("Failed to exchange authorization code");
    }

    const tokens: DiscordTokenResponse = await tokenResponse.json();

    // Fetch Discord user info
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      console.error("Discord user fetch error:", await userResponse.text());
      return redirectWithError("Failed to fetch Discord user info");
    }

    const discordUser: DiscordUser = await userResponse.json();

    // Save Discord user ID to user_profiles
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ discord_user_id: discordUser.id })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Profile update error:", updateError);
      return redirectWithError("Failed to link Discord account");
    }

    console.log(`Discord account ${discordUser.id} linked to user ${userId}`);

    // Redirect back to the app with success
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${returnUrl}?discord_linked=true`,
      },
    });
  } catch (error: unknown) {
    console.error("Discord OAuth callback error:", error);
    return redirectWithError((error as Error).message);
  }
});

function redirectWithError(message: string): Response {
  const encodedMessage = encodeURIComponent(message);
  return new Response(null, {
    status: 302,
    headers: {
      Location: `/settings?discord_error=${encodedMessage}`,
    },
  });
}
