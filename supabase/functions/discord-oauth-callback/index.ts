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
      return redirectWithError("Discord authorization was denied", undefined);
    }

    if (!code || !state) {
      return redirectWithError("Missing authorization code or state", undefined);
    }

    const clientId = Deno.env.get("DISCORD_CLIENT_ID")!;
    const clientSecret = Deno.env.get("DISCORD_CLIENT_SECRET")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Parse state to get user_id (state is base64 encoded JSON with user_id)
    let userId: string;
    let returnUrl: string;
    let appOrigin: string;
    try {
      const stateData = JSON.parse(atob(state));
      userId = stateData.user_id;
      // Always redirect to /settings after Discord link - the original path might not exist
      // or could cause routing issues with library slugs, etc.
      returnUrl = "/settings";
      appOrigin = stateData.app_origin;
      console.log("Discord OAuth state parsed:", { userId, returnUrl, appOrigin, originalReturnUrl: stateData.return_url });
    } catch (parseError) {
      console.error("Failed to parse state:", parseError);
      return redirectWithError("Invalid state parameter", undefined);
    }

    if (!userId || !appOrigin) {
      return redirectWithError("Missing user ID or app origin in state", appOrigin);
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
      return redirectWithError("Failed to exchange authorization code", appOrigin);
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
      return redirectWithError("Failed to fetch Discord user info", appOrigin);
    }

    const discordUser: DiscordUser = await userResponse.json();

    // Save Discord user ID to user_profiles
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // First check if profile exists
    const { data: existingProfile } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    let upsertError;
    if (existingProfile) {
      // Update existing profile
      const { error } = await supabase
        .from("user_profiles")
        .update({ discord_user_id: discordUser.id })
        .eq("user_id", userId);
      upsertError = error;
    } else {
      // Create new profile with Discord ID
      const { error } = await supabase
        .from("user_profiles")
        .insert({ user_id: userId, discord_user_id: discordUser.id });
      upsertError = error;
    }

    if (upsertError) {
      console.error("Profile update error:", upsertError);
      return redirectWithError("Failed to link Discord account", appOrigin);
    }

    console.log(`Discord account ${discordUser.id} linked to user ${userId}`);

    // Redirect back to the app with success
    const fullReturnUrl = returnUrl.startsWith("http") ? returnUrl : `${appOrigin}${returnUrl}`;
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${fullReturnUrl}${fullReturnUrl.includes("?") ? "&" : "?"}discord_linked=true`,
      },
    });
  } catch (error: unknown) {
    console.error("Discord OAuth callback error:", error);
    return redirectWithError((error as Error).message, undefined);
  }
});

function redirectWithError(message: string, appOrigin: string | undefined): Response {
  const encodedMessage = encodeURIComponent(message);
  // If we have the app origin, redirect back to the app; otherwise show a simple error page
  if (appOrigin) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${appOrigin}/settings?discord_error=${encodedMessage}`,
      },
    });
  }
  // Fallback: display error directly (can't redirect without knowing the app origin)
  return new Response(`Discord connection failed: ${message}. Please close this tab and try again.`, {
    status: 400,
    headers: { "Content-Type": "text/plain" },
  });
}
