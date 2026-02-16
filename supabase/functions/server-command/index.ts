import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_SCRIPTS = [
  "update", "backup", "migrations", "restore", "render-kong",
  "setup-ssl", "create-admin", "preflight", "rebuild-frontend",
  "restart-functions", "clean-install", "nuclear-reset",
];

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

  // Verify admin access
  const authHeader = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  if (!authHeader || authHeader === anonKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${authHeader}` } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Parse body - all actions come via POST body
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine for list action
  }

  const action = (body.action as string) || "list";

  // Queue a command
  if (action === "run") {
    const scriptId = body.script_id as string;

    if (!scriptId || !ALLOWED_SCRIPTS.includes(scriptId)) {
      return new Response(JSON.stringify({ error: "Invalid script_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for already-pending command for same script
    const { data: existing } = await supabase
      .from("server_commands")
      .select("id")
      .eq("script_id", scriptId)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "Command already pending", command_id: existing.id }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase
      .from("server_commands")
      .insert({ script_id: scriptId, requested_by: user.id })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ command: data }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check specific command status
  if (action === "status") {
    const commandId = body.id as string;
    if (commandId) {
      const { data, error } = await supabase
        .from("server_commands")
        .select("*")
        .eq("id", commandId)
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ command: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // List recent commands (default action)
  if (action === "list" || action === "status") {
    const { data, error } = await supabase
      .from("server_commands")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    return new Response(JSON.stringify({ commands: data || [], error: error?.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Unknown action. Use 'run', 'status', or 'list'" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

if (import.meta.main) {
  Deno.serve(handler);
}
