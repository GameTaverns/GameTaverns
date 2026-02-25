import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Edge function to send push notifications via Firebase Cloud Messaging (FCM) HTTP v1 API.
 *
 * Triggered by:
 *   1. Database webhook on notification_log INSERT
 *   2. Direct invocation from client code
 *
 * Expects JSON body:
 *   { user_id, title, body, data?, notification_type? }
 *
 * Or from DB webhook:
 *   { type: "INSERT", record: { user_id, title, body, metadata, notification_type } }
 */

interface FCMMessage {
  message: {
    token: string;
    notification: {
      title: string;
      body?: string;
    };
    data?: Record<string, string>;
    android?: {
      priority: string;
      notification: {
        sound: string;
        default_sound: boolean;
        channel_id: string;
      };
    };
    apns?: {
      payload: {
        aps: {
          sound: string;
          badge: number;
          "content-available": number;
        };
      };
    };
  };
}

// Get an OAuth2 access token from the Firebase service account
async function getFirebaseAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };

  // Encode JWT
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key and sign
  const pemContents = serviceAccount.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsignedToken}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    const err = await tokenResponse.text();
    throw new Error(`Failed to get Firebase access token: ${err}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const FIREBASE_SERVICE_ACCOUNT_JSON = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");

    if (!FIREBASE_SERVICE_ACCOUNT_JSON) {
      console.error("FIREBASE_SERVICE_ACCOUNT_JSON secret not configured");
      return new Response(
        JSON.stringify({ error: "Push notifications not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
    const projectId = serviceAccount.project_id;

    // Parse request body
    const body = await req.json();

    // Handle DB webhook format vs direct invocation
    let userId: string;
    let title: string;
    let notifBody: string | undefined;
    let data: Record<string, string> = {};

    if (body.type === "INSERT" && body.record) {
      // Database webhook payload
      const record = body.record;
      userId = record.user_id;
      title = record.title;
      notifBody = record.body || undefined;
      data = {
        notification_type: record.notification_type || "general",
        ...(record.metadata ? (typeof record.metadata === "string" ? JSON.parse(record.metadata) : record.metadata) : {}),
      };
    } else {
      // Direct invocation
      userId = body.user_id;
      title = body.title;
      notifBody = body.body || undefined;
      data = body.data || {};
      if (body.notification_type) {
        data.notification_type = body.notification_type;
      }
    }

    if (!userId || !title) {
      return new Response(
        JSON.stringify({ error: "user_id and title are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's push tokens
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: tokens, error: tokensError } = await supabaseAdmin
      .from("user_push_tokens")
      .select("token, platform")
      .eq("user_id", userId);

    if (tokensError) {
      console.error("Error fetching push tokens:", tokensError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch push tokens" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tokens || tokens.length === 0) {
      console.log(`No push tokens found for user ${userId}`);
      return new Response(
        JSON.stringify({ sent: 0, message: "No push tokens registered" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Firebase access token
    const accessToken = await getFirebaseAccessToken(serviceAccount);
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    // Stringify all data values (FCM requires string values)
    const stringData: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      stringData[key] = typeof value === "string" ? value : JSON.stringify(value);
    }

    let sent = 0;
    const failed: string[] = [];

    // Send to each registered token
    for (const { token, platform } of tokens) {
      const message: FCMMessage = {
        message: {
          token,
          notification: {
            title,
            body: notifBody,
          },
          data: stringData,
          android: {
            priority: "high",
            notification: {
              sound: "default",
              default_sound: true,
              channel_id: "gametaverns_notifications",
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
                badge: 1,
                "content-available": 1,
              },
            },
          },
        },
      };

      try {
        const response = await fetch(fcmUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(message),
        });

        if (response.ok) {
          sent++;
        } else {
          const errText = await response.text();
          console.error(`FCM send failed for token ${token.substring(0, 10)}...:`, errText);
          failed.push(token);

          // If token is invalid/unregistered, remove it
          if (response.status === 404 || errText.includes("UNREGISTERED")) {
            await supabaseAdmin
              .from("user_push_tokens")
              .delete()
              .eq("token", token);
            console.log(`Removed stale push token: ${token.substring(0, 10)}...`);
          }
        }
      } catch (sendError) {
        console.error(`Error sending to token ${token.substring(0, 10)}...:`, sendError);
        failed.push(token);
      }
    }

    return new Response(
      JSON.stringify({ sent, failed: failed.length, total: tokens.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Push notification error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
