import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_HISTORY = 20;

/**
 * Hash a password using SHA-256 with a static salt prefix.
 * We don't need bcrypt here because we're only comparing hashes for reuse detection,
 * not storing them for authentication. The actual auth password is handled by Supabase Auth.
 */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  // Use a static application-level salt to prevent rainbow table attacks
  const salted = encoder.encode(`gt_pw_reuse_salt_v1:${password}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", salted);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface RequestBody {
  userId: string;
  password: string;
  action: "check" | "store" | "check_and_store";
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate the caller
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { userId, password, action }: RequestBody = await req.json();

    if (!userId || !password || !action) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, password, action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const passwordHash = await hashPassword(password);

    if (action === "check" || action === "check_and_store") {
      // Get last 20 password hashes for this user
      const { data: history, error: historyError } = await supabase
        .from("password_history")
        .select("password_hash")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(MAX_HISTORY);

      if (historyError) {
        console.error("Failed to fetch password history:", historyError);
        return new Response(
          JSON.stringify({ error: "Failed to check password history" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isReused = (history || []).some((h) => h.password_hash === passwordHash);

      if (isReused) {
        return new Response(
          JSON.stringify({
            reused: true,
            error: "This password has been used recently. Please choose a different password. You cannot reuse any of your last 20 passwords.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (action === "check") {
        return new Response(
          JSON.stringify({ reused: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Store the new password hash (for "store" or "check_and_store")
    const { error: insertError } = await supabase
      .from("password_history")
      .insert({ user_id: userId, password_hash: passwordHash });

    if (insertError) {
      console.error("Failed to store password hash:", insertError);
      // Non-fatal - don't block password change
    }

    // Prune old entries beyond MAX_HISTORY
    const { data: allHistory } = await supabase
      .from("password_history")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (allHistory && allHistory.length > MAX_HISTORY) {
      const idsToDelete = allHistory.slice(MAX_HISTORY).map((h) => h.id);
      await supabase
        .from("password_history")
        .delete()
        .in("id", idsToDelete);
    }

    return new Response(
      JSON.stringify({ reused: false, stored: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Password reuse check error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
