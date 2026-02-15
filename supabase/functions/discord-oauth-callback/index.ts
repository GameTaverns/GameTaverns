import { createClient } from "npm:@supabase/supabase-js@2";

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

function redirectWithError(message: string, appOrigin: string | undefined): Response {
  const encodedMessage = encodeURIComponent(message);
  if (appOrigin) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${appOrigin}/settings?discord_error=${encodedMessage}`,
      },
    });
  }
  return new Response(`Discord connection failed: ${message}. Please close this tab and try again.`, {
    status: 400,
    headers: { "Content-Type": "text/plain" },
  });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
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
    const appUrl = Deno.env.get("APP_URL") || supabaseUrl;

    let userId: string;
    let returnUrl: string;
    let appOrigin: string;
    try {
      const stateData = JSON.parse(atob(state));
      userId = stateData.user_id;
      returnUrl = "/dashboard";
      appOrigin = stateData.app_origin;
      
      if (appOrigin) {
        try {
          const originUrl = new URL(appOrigin);
          const hostParts = originUrl.hostname.split('.');
          if (hostParts.length > 2 && 
              (originUrl.hostname.endsWith('.gametaverns.com') || originUrl.hostname.endsWith('.gamehavens.com'))) {
            const mainDomain = hostParts.slice(-2).join('.');
            appOrigin = `${originUrl.protocol}//${mainDomain}`;
          }
        } catch {
          // Keep original appOrigin if parsing fails
        }
      }
      
      console.log("Discord OAuth state parsed:", { userId, returnUrl, appOrigin, originalReturnUrl: stateData.return_url });
    } catch (parseError) {
      console.error("Failed to parse state:", parseError);
      return redirectWithError("Invalid state parameter", undefined);
    }

    if (!userId || !appOrigin) {
      return redirectWithError("Missing user ID or app origin in state", appOrigin);
    }

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
        redirect_uri: `${appUrl}/functions/v1/discord-oauth-callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Discord token error:", errorText);
      return redirectWithError("Failed to exchange authorization code", appOrigin);
    }

    const tokens: DiscordTokenResponse = await tokenResponse.json();

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

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: existingProfile } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    let upsertError;
    if (existingProfile) {
      const { error } = await supabase
        .from("user_profiles")
        .update({ discord_user_id: discordUser.id })
        .eq("user_id", userId);
      upsertError = error;
    } else {
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
};

export default handler;

if (import.meta.main) {
  Deno.serve(handler);
}
