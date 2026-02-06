import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("API_EXTERNAL_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing Supabase configuration");
    }

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.slice(7);
    const supabase = createClient(supabaseUrl, serviceKey);
    
    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, libraryId } = await req.json();
    
    if (!action || !libraryId) {
      return new Response(JSON.stringify({ error: "Missing action or libraryId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result;
    
    switch (action) {
      case "join": {
        // Check if already a member
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
        result = data;
        break;
      }
      
      case "leave": {
        const { error } = await supabase
          .from("library_members")
          .delete()
          .eq("library_id", libraryId)
          .eq("user_id", user.id);
        
        if (error) throw error;
        result = { success: true };
        break;
      }
      
      case "follow": {
        // Check if already following
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
        result = data;
        break;
      }
      
      case "unfollow": {
        const { error } = await supabase
          .from("library_followers")
          .delete()
          .eq("library_id", libraryId)
          .eq("follower_user_id", user.id);
        
        if (error) throw error;
        result = { success: true };
        break;
      }
      
      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Membership error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
