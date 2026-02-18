import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Router-compatible handler.
 *
 * IMPORTANT: In self-hosted deployments, this module is imported by the main
 * function router (supabase/functions/main). Therefore it MUST NOT call
 * Deno.serve() at import time.
 */
export default async function profileUpdateHandler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.slice("Bearer ".length).trim();

    // Create client with user's token for auth
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user
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

    const userId = user.id;
    const body = await req.json();

    // Validate input
    const allowedFields = [
      "display_name",
      "username",
      "bio",
      "avatar_url",
      "banner_url",
      "featured_achievement_id",
      // Profile theme fields
      "profile_primary_h",
      "profile_primary_s",
      "profile_primary_l",
      "profile_accent_h",
      "profile_accent_s",
      "profile_accent_l",
      "profile_background_h",
      "profile_background_s",
      "profile_background_l",
      "profile_bg_image_url",
      "profile_bg_opacity",
    ];
    const updates: Record<string, any> = {};

    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: "No valid fields to update" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin client for the update (bypasses PostgREST schema cache issues)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check username uniqueness if changing
    if (updates.username) {
      const { data: existing } = await adminClient
        .from("user_profiles")
        .select("id")
        .ilike("username", updates.username)
        .neq("user_id", userId)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: "Username already taken" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Validate featured_achievement_id if provided
    if (updates.featured_achievement_id !== undefined && updates.featured_achievement_id !== null) {
      const { data: hasAchievement } = await adminClient
        .from("user_achievements")
        .select("id")
        .eq("user_id", userId)
        .eq("achievement_id", updates.featured_achievement_id)
        .maybeSingle();

      if (!hasAchievement) {
        return new Response(
          JSON.stringify({ error: "You can only feature achievements you have earned" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Perform the update
    const { data, error } = await adminClient
      .from("user_profiles")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      // Make self-hosted debugging actually actionable
      console.error("Profile update error:", JSON.stringify(error, null, 2));
      return new Response(
        JSON.stringify({
          error: "Failed to update profile",
          code: (error as any).code ?? null,
          message: (error as any).message ?? String(error),
          details: (error as any).details ?? null,
          hint: (error as any).hint ?? null,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// Standalone mode (Lovable Cloud / direct deploy) 
if (import.meta.main) {
  Deno.serve(profileUpdateHandler);
}

