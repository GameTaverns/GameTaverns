import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
};

type AnyRecord = Record<string, unknown>;

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("API_EXTERNAL_URL");
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing backend configuration");
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Read libraryId from query (GET) or body (PUT/POST)
    let libraryId: string | null = null;
    let body: AnyRecord | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      libraryId = url.searchParams.get("libraryId");
    } else {
      body = (await req.json()) as AnyRecord;
      libraryId = (body.libraryId as string) || null;
    }

    if (!libraryId) {
      return new Response(JSON.stringify({ error: "Missing libraryId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("library_settings")
        .select("*")
        .eq("library_id", libraryId)
        .maybeSingle();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Library settings not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method !== "PUT" && req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth required for PUT/POST
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.slice(7);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership (or platform admin)
    const { data: library } = await supabase
      .from("libraries")
      .select("owner_id")
      .eq("id", libraryId)
      .maybeSingle();

    if (!library) {
      return new Response(JSON.stringify({ error: "Library not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (library.owner_id !== user.id) {
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!adminRole) {
        return new Response(JSON.stringify({ error: "Not authorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const updateBody = (body || {}) as AnyRecord;

    const allowedFields = [
      "allow_lending",
      "contact_email",
      "discord_url",
      "discord_webhook_url",
      "discord_events_channel_id",
      "discord_notifications",
      "facebook_url",
      "instagram_url",
      "twitter_handle",
      "footer_text",
      "lending_terms",
      "logo_url",
      "background_image_url",
      "background_overlay_opacity",
      "is_discoverable",
      "turnstile_site_key",
      // Feature flags
      "feature_play_logs",
      "feature_wishlist",
      "feature_for_sale",
      "feature_messaging",
      "feature_coming_soon",
      "feature_ratings",
      "feature_events",
      "feature_achievements",
      "feature_lending",
      // Theme colors (light mode)
      "theme_primary_h",
      "theme_primary_s",
      "theme_primary_l",
      "theme_accent_h",
      "theme_accent_s",
      "theme_accent_l",
      "theme_background_h",
      "theme_background_s",
      "theme_background_l",
      "theme_card_h",
      "theme_card_s",
      "theme_card_l",
      "theme_sidebar_h",
      "theme_sidebar_s",
      "theme_sidebar_l",
      // Theme foreground/text colors (light mode)
      "theme_foreground_h",
      "theme_foreground_s",
      "theme_foreground_l",
      // Theme colors (dark mode)
      "theme_dark_primary_h",
      "theme_dark_primary_s",
      "theme_dark_primary_l",
      "theme_dark_accent_h",
      "theme_dark_accent_s",
      "theme_dark_accent_l",
      "theme_dark_background_h",
      "theme_dark_background_s",
      "theme_dark_background_l",
      "theme_dark_card_h",
      "theme_dark_card_s",
      "theme_dark_card_l",
      "theme_dark_sidebar_h",
      "theme_dark_sidebar_s",
      "theme_dark_sidebar_l",
      // Theme foreground/text colors (dark mode)
      "theme_dark_foreground_h",
      "theme_dark_foreground_s",
      "theme_dark_foreground_l",
      // Theme fonts
      "theme_font_display",
      "theme_font_body",
    ];

    const updates: AnyRecord = {};
    for (const field of allowedFields) {
      if (updateBody[field] !== undefined) {
        updates[field] = updateBody[field];
      }
    }

    // allow passing allow_lending alongside feature_lending
    if (updateBody.allow_lending !== undefined) {
      updates.allow_lending = updateBody.allow_lending;
    }

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: "No valid fields to update" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("library_settings")
      .update(updates)
      .eq("library_id", libraryId)
      .select()
      .single();

    if (error) {
      console.error("Update error:", error);
      return new Response(JSON.stringify({ error: "Failed to update settings" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Library settings error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
