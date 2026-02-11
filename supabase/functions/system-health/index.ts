import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthCheck {
  name: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  latencyMs: number;
  message?: string;
  details?: Record<string, unknown>;
}

async function checkDatabase(supabase: ReturnType<typeof createClient>): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const { count, error } = await supabase
      .from("games")
      .select("*", { count: "exact", head: true });
    const latency = Date.now() - start;
    if (error) {
      return { name: "Database", status: "degraded", latencyMs: latency, message: error.message };
    }
    return {
      name: "Database",
      status: latency > 5000 ? "degraded" : "healthy",
      latencyMs: latency,
      details: { gameCount: count },
    };
  } catch (e) {
    return { name: "Database", status: "down", latencyMs: Date.now() - start, message: String(e) };
  }
}

async function checkImageProxy(supabaseUrl: string): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Use a known small BGG image to test the proxy
    const testUrl = "https://cf.geekdo-images.com/thumb/img/placeholder.png";
    const proxyUrl = `${supabaseUrl}/functions/v1/image-proxy?url=${encodeURIComponent(testUrl)}`;
    const resp = await fetch(proxyUrl, { method: "GET", signal: AbortSignal.timeout(10000) });
    const latency = Date.now() - start;
    if (resp.status === 429) {
      return { name: "Image Proxy", status: "degraded", latencyMs: latency, message: "Rate limited" };
    }
    // 404 is ok - means the proxy is running but the test image doesn't exist
    if (resp.ok || resp.status === 404) {
      return { name: "Image Proxy", status: "healthy", latencyMs: latency };
    }
    return { name: "Image Proxy", status: "degraded", latencyMs: latency, message: `HTTP ${resp.status}` };
  } catch (e) {
    return { name: "Image Proxy", status: "down", latencyMs: Date.now() - start, message: String(e) };
  }
}

async function checkBggApi(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const resp = await fetch("https://boardgamegeek.com/xmlapi2/thing?id=174430&stats=0", {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "GameTaverns/HealthCheck" },
    });
    const latency = Date.now() - start;
    if (resp.status === 429) {
      return { name: "BGG API", status: "degraded", latencyMs: latency, message: "Rate limited by BGG" };
    }
    if (resp.status === 401 || resp.status === 403) {
      return { name: "BGG API", status: "degraded", latencyMs: latency, message: "Auth issue" };
    }
    if (resp.ok) {
      return {
        name: "BGG API",
        status: latency > 10000 ? "degraded" : "healthy",
        latencyMs: latency,
      };
    }
    return { name: "BGG API", status: "degraded", latencyMs: latency, message: `HTTP ${resp.status}` };
  } catch (e) {
    return { name: "BGG API", status: "down", latencyMs: Date.now() - start, message: String(e) };
  }
}

async function checkEdgeFunctions(supabaseUrl: string): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Ping a lightweight function
    const resp = await fetch(`${supabaseUrl}/functions/v1/totp-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(10000),
    });
    const latency = Date.now() - start;
    // Even a 401 means the function runtime is responding
    if (resp.status < 500) {
      return { name: "Edge Functions", status: "healthy", latencyMs: latency };
    }
    return { name: "Edge Functions", status: "degraded", latencyMs: latency, message: `HTTP ${resp.status}` };
  } catch (e) {
    return { name: "Edge Functions", status: "down", latencyMs: Date.now() - start, message: String(e) };
  }
}

async function checkAuth(supabaseUrl: string, anonKey: string): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const resp = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(10000),
    });
    const latency = Date.now() - start;
    if (resp.ok) {
      return { name: "Auth Service", status: "healthy", latencyMs: latency };
    }
    return { name: "Auth Service", status: "degraded", latencyMs: latency, message: `HTTP ${resp.status}` };
  } catch (e) {
    return { name: "Auth Service", status: "down", latencyMs: Date.now() - start, message: String(e) };
  }
}

async function checkStorage(supabase: ReturnType<typeof createClient>): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const { data, error } = await supabase.storage.listBuckets();
    const latency = Date.now() - start;
    if (error) {
      return { name: "Storage", status: "degraded", latencyMs: latency, message: error.message };
    }
    return {
      name: "Storage",
      status: "healthy",
      latencyMs: latency,
      details: { buckets: data?.length || 0 },
    };
  } catch (e) {
    return { name: "Storage", status: "down", latencyMs: Date.now() - start, message: String(e) };
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

  // Verify admin access
  const authHeader = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  if (authHeader && authHeader !== anonKey) {
    const { data: { user } } = await createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${authHeader}` } },
    }).auth.getUser();

    if (user) {
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
    } else {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "health";

  if (action === "health") {
    // Run all health checks in parallel
    const [db, imageProxy, bgg, edgeFns, auth, storage] = await Promise.all([
      checkDatabase(supabase),
      checkImageProxy(supabaseUrl),
      checkBggApi(),
      checkEdgeFunctions(supabaseUrl),
      checkAuth(supabaseUrl, anonKey),
      checkStorage(supabase),
    ]);

    // Get DB stats
    const { count: totalGames } = await supabase
      .from("games")
      .select("*", { count: "exact", head: true });
    const { count: totalLibraries } = await supabase
      .from("libraries")
      .select("*", { count: "exact", head: true });
    const { count: totalSessions } = await supabase
      .from("game_sessions")
      .select("*", { count: "exact", head: true });

    const checks = [db, imageProxy, bgg, edgeFns, auth, storage];
    const overallStatus = checks.some((c) => c.status === "down")
      ? "down"
      : checks.some((c) => c.status === "degraded")
      ? "degraded"
      : "healthy";

    return new Response(
      JSON.stringify({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        checks,
        stats: {
          totalGames: totalGames || 0,
          totalLibraries: totalLibraries || 0,
          totalSessions: totalSessions || 0,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (action === "logs") {
    const source = url.searchParams.get("source") || undefined;
    const level = url.searchParams.get("level") || undefined;
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);

    let query = supabase
      .from("system_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (source) query = query.eq("source", source);
    if (level) query = query.eq("level", level);

    const { data, error } = await query;

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ logs: data || [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "cleanup") {
    const days = parseInt(url.searchParams.get("days") || "30");
    const { data, error } = await supabase.rpc("cleanup_old_system_logs", {
      retention_days: days,
    });

    return new Response(
      JSON.stringify({ deleted: data, error: error?.message }),
      {
        status: error ? 500 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(handler);
