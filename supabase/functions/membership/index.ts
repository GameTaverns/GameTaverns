import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface MembershipRequest {
  action: "join" | "leave" | "follow" | "unfollow";
  libraryId: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("API_EXTERNAL_URL");
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing backend configuration");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.slice(7);
    const supabase = createClient(supabaseUrl, serviceKey);

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

    const body = (await req.json()) as Partial<MembershipRequest>;
    const action = body.action;
    const libraryId = body.libraryId;

    if (!action || !libraryId) {
      return new Response(JSON.stringify({ error: "Missing action or libraryId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    switch (action) {
      case "join": {
        const { data: existing } = await supabase
          .from("library_members")
          .select("id")
          .eq("library_id", libraryId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (existing) {
          return new Response(JSON.stringify({ error: "Already a member" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data, error } = await supabase
          .from("library_members")
          .insert({
            library_id: libraryId,
            user_id: user.id,
            role: "member",
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "leave": {
        const { error } = await supabase
          .from("library_members")
          .delete()
          .eq("library_id", libraryId)
          .eq("user_id", user.id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "follow": {
        const { data: existing } = await supabase
          .from("library_followers")
          .select("id")
          .eq("library_id", libraryId)
          .eq("follower_user_id", user.id)
          .maybeSingle();

        if (existing) {
          return new Response(JSON.stringify({ error: "Already following" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data, error } = await supabase
          .from("library_followers")
          .insert({
            library_id: libraryId,
            follower_user_id: user.id,
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "unfollow": {
        const { error } = await supabase
          .from("library_followers")
          .delete()
          .eq("library_id", libraryId)
          .eq("follower_user_id", user.id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
  } catch (error: any) {
    console.error("Membership error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
