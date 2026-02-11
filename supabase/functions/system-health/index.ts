import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthCheck {
  name: string;
  group: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  latencyMs: number;
  message?: string;
  details?: Record<string, unknown>;
}

// ---------- helpers ----------

async function pingFunction(
  supabaseUrl: string,
  name: string,
  group: string,
  fnPath: string,
  method = "POST",
  body: string | null = "{}",
  timeoutMs = 10000,
): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const opts: RequestInit = {
      method,
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    };
    if (body && method !== "GET") opts.body = body;
    const resp = await fetch(`${supabaseUrl}/functions/v1/${fnPath}`, opts);
    const latency = Date.now() - start;
    // Any response < 500 means the runtime is alive
    if (resp.status < 500) {
      return { name, group, status: "healthy", latencyMs: latency };
    }
    return { name, group, status: "degraded", latencyMs: latency, message: `HTTP ${resp.status}` };
  } catch (e) {
    return { name, group, status: "down", latencyMs: Date.now() - start, message: String(e) };
  }
}

// ---------- individual checks ----------

async function checkDatabase(supabase: ReturnType<typeof createClient>): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const { count, error } = await supabase
      .from("games")
      .select("*", { count: "exact", head: true });
    const latency = Date.now() - start;
    if (error) return { name: "Database", group: "core", status: "degraded", latencyMs: latency, message: error.message };
    return { name: "Database", group: "core", status: latency > 5000 ? "degraded" : "healthy", latencyMs: latency, details: { gameCount: count } };
  } catch (e) {
    return { name: "Database", group: "core", status: "down", latencyMs: Date.now() - start, message: String(e) };
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
    if (resp.ok) return { name: "Auth Service", group: "core", status: "healthy", latencyMs: latency };
    return { name: "Auth Service", group: "core", status: "degraded", latencyMs: latency, message: `HTTP ${resp.status}` };
  } catch (e) {
    return { name: "Auth Service", group: "core", status: "down", latencyMs: Date.now() - start, message: String(e) };
  }
}

async function checkStorage(supabase: ReturnType<typeof createClient>): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const { data, error } = await supabase.storage.listBuckets();
    const latency = Date.now() - start;
    if (error) return { name: "Storage", group: "core", status: "degraded", latencyMs: latency, message: error.message };
    return { name: "Storage", group: "core", status: "healthy", latencyMs: latency, details: { buckets: data?.length || 0 } };
  } catch (e) {
    return { name: "Storage", group: "core", status: "down", latencyMs: Date.now() - start, message: String(e) };
  }
}

async function checkRealtime(supabaseUrl: string, anonKey: string): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Realtime health endpoint
    const url = supabaseUrl.replace(/\/+$/, "");
    const resp = await fetch(`${url}/realtime/v1/`, {
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(10000),
    });
    const latency = Date.now() - start;
    if (resp.status < 500) return { name: "Realtime", group: "core", status: "healthy", latencyMs: latency };
    return { name: "Realtime", group: "core", status: "degraded", latencyMs: latency, message: `HTTP ${resp.status}` };
  } catch (e) {
    return { name: "Realtime", group: "core", status: "down", latencyMs: Date.now() - start, message: String(e) };
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
    if (resp.status === 429) return { name: "BGG API", group: "external", status: "degraded", latencyMs: latency, message: "Rate limited" };
    if (resp.ok) return { name: "BGG API", group: "external", status: latency > 10000 ? "degraded" : "healthy", latencyMs: latency };
    return { name: "BGG API", group: "external", status: "degraded", latencyMs: latency, message: `HTTP ${resp.status}` };
  } catch (e) {
    return { name: "BGG API", group: "external", status: "down", latencyMs: Date.now() - start, message: String(e) };
  }
}

// ---------- handler ----------

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
    // Run ALL health checks in parallel
    const checks = await Promise.all([
      // Core infrastructure
      checkDatabase(supabase),
      checkAuth(supabaseUrl, anonKey),
      checkStorage(supabase),
      checkRealtime(supabaseUrl, anonKey),

      // External services
      checkBggApi(),

      // Edge Functions - Auth & Security
      pingFunction(supabaseUrl, "Signup", "auth", "signup"),
      pingFunction(supabaseUrl, "Verify Email", "auth", "verify-email"),
      pingFunction(supabaseUrl, "Send Auth Email", "auth", "send-auth-email"),
      pingFunction(supabaseUrl, "Verify Reset Token", "auth", "verify-reset-token"),
      pingFunction(supabaseUrl, "Resolve Username", "auth", "resolve-username"),
      pingFunction(supabaseUrl, "TOTP Status", "auth", "totp-status"),
      pingFunction(supabaseUrl, "TOTP Setup", "auth", "totp-setup"),
      pingFunction(supabaseUrl, "TOTP Verify", "auth", "totp-verify"),
      pingFunction(supabaseUrl, "TOTP Disable", "auth", "totp-disable"),
      pingFunction(supabaseUrl, "Manage Account", "auth", "manage-account"),

      // Edge Functions - Game Operations
      pingFunction(supabaseUrl, "Image Proxy", "games", "image-proxy", "GET", null),
      pingFunction(supabaseUrl, "BGG Lookup", "games", "bgg-lookup"),
      pingFunction(supabaseUrl, "BGG Import", "games", "bgg-import"),
      pingFunction(supabaseUrl, "BGG Sync", "games", "bgg-sync"),
      pingFunction(supabaseUrl, "BGG Sync Cron", "games", "bgg-sync-cron"),
      pingFunction(supabaseUrl, "BGG Play Import", "games", "bgg-play-import"),
      pingFunction(supabaseUrl, "Game Import", "games", "game-import"),
      pingFunction(supabaseUrl, "Bulk Import", "games", "bulk-import"),
      pingFunction(supabaseUrl, "Rate Game", "games", "rate-game"),
      pingFunction(supabaseUrl, "Wishlist", "games", "wishlist"),
      pingFunction(supabaseUrl, "Game Recs", "games", "game-recommendations"),
      pingFunction(supabaseUrl, "Refresh Images", "games", "refresh-images"),
      pingFunction(supabaseUrl, "Condense Desc", "games", "condense-descriptions"),

      // Edge Functions - Social & Communication
      pingFunction(supabaseUrl, "Send Message", "social", "send-message"),
      pingFunction(supabaseUrl, "Decrypt Messages", "social", "decrypt-messages"),
      pingFunction(supabaseUrl, "My Inquiries", "social", "my-inquiries"),
      pingFunction(supabaseUrl, "Reply Inquiry", "social", "reply-to-inquiry"),
      pingFunction(supabaseUrl, "Send Inq Reply", "social", "send-inquiry-reply"),
      pingFunction(supabaseUrl, "Notify Feedback", "social", "notify-feedback"),

      // Edge Functions - Discord
      pingFunction(supabaseUrl, "Discord Config", "discord", "discord-config", "GET", null),
      pingFunction(supabaseUrl, "Discord Notify", "discord", "discord-notify"),
      pingFunction(supabaseUrl, "Discord Send DM", "discord", "discord-send-dm"),
      pingFunction(supabaseUrl, "Discord Forum", "discord", "discord-forum-post"),
      pingFunction(supabaseUrl, "Discord Event", "discord", "discord-create-event"),
      pingFunction(supabaseUrl, "Discord Del Thread", "discord", "discord-delete-thread"),
      pingFunction(supabaseUrl, "Discord OAuth", "discord", "discord-oauth-callback", "GET", null),
      pingFunction(supabaseUrl, "Discord Unlink", "discord", "discord-unlink"),

      // Edge Functions - Library & Admin
      pingFunction(supabaseUrl, "Library Settings", "admin", "library-settings"),
      pingFunction(supabaseUrl, "Membership", "admin", "membership"),
      pingFunction(supabaseUrl, "Profile Update", "admin", "profile-update"),
      pingFunction(supabaseUrl, "Manage Users", "admin", "manage-users"),
      pingFunction(supabaseUrl, "Sync Achievements", "admin", "sync-achievements"),
      pingFunction(supabaseUrl, "Clubs", "admin", "clubs"),
    ]);

    // DB stats
    const [gamesRes, libRes, sessRes, usersRes] = await Promise.all([
      supabase.from("games").select("*", { count: "exact", head: true }),
      supabase.from("libraries").select("*", { count: "exact", head: true }),
      supabase.from("game_sessions").select("*", { count: "exact", head: true }),
      supabase.from("user_profiles").select("*", { count: "exact", head: true }),
    ]);

    const overallStatus = checks.some((c) => c.status === "down")
      ? "down"
      : checks.some((c) => c.status === "degraded")
      ? "degraded"
      : "healthy";

    const downCount = checks.filter(c => c.status === "down").length;
    const degradedCount = checks.filter(c => c.status === "degraded").length;
    const healthyCount = checks.filter(c => c.status === "healthy").length;

    return new Response(
      JSON.stringify({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        summary: { total: checks.length, healthy: healthyCount, degraded: degradedCount, down: downCount },
        checks,
        stats: {
          totalGames: gamesRes.count || 0,
          totalLibraries: libRes.count || 0,
          totalSessions: sessRes.count || 0,
          totalUsers: usersRes.count || 0,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
    const { data, error } = await supabase.rpc("cleanup_old_system_logs", { retention_days: days });

    return new Response(
      JSON.stringify({ deleted: data, error: error?.message }),
      { status: error ? 500 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

if (import.meta.main) {
  Deno.serve(handler);
}
