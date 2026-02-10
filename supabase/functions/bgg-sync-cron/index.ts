import { createClient } from "npm:@supabase/supabase-js@2";

// This function is called by pg_cron to trigger BGG sync for all libraries
// with auto-sync enabled. It iterates through each library and calls the
// bgg-sync function with the service role key.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get all libraries with BGG sync enabled
    const { data: libraries, error } = await supabaseAdmin
      .from("library_settings")
      .select("library_id, bgg_username, bgg_sync_frequency, bgg_last_synced_at")
      .eq("bgg_sync_enabled", true)
      .not("bgg_username", "is", null);

    if (error) {
      console.error("[BGGSyncCron] Failed to fetch libraries:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!libraries || libraries.length === 0) {
      return new Response(JSON.stringify({ message: "No libraries with BGG sync enabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[BGGSyncCron] Found ${libraries.length} libraries with sync enabled`);

    const results: { library_id: string; status: string; message?: string }[] = [];

    for (const lib of libraries) {
      // Check if sync is needed based on frequency
      const now = new Date();
      const lastSync = lib.bgg_last_synced_at ? new Date(lib.bgg_last_synced_at) : null;

      if (lastSync) {
        const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);
        if (lib.bgg_sync_frequency === "daily" && hoursSinceSync < 20) {
          results.push({ library_id: lib.library_id, status: "skipped", message: "Too soon for daily sync" });
          continue;
        }
        if (lib.bgg_sync_frequency === "weekly" && hoursSinceSync < 144) {
          results.push({ library_id: lib.library_id, status: "skipped", message: "Too soon for weekly sync" });
          continue;
        }
      }

      // Get library owner for auth context
      const { data: library } = await supabaseAdmin
        .from("libraries")
        .select("owner_id")
        .eq("id", lib.library_id)
        .single();

      if (!library) {
        results.push({ library_id: lib.library_id, status: "error", message: "Library not found" });
        continue;
      }

      // Call bgg-sync with service role as the owner
      try {
        const base = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        const res = await fetch(`${base}/functions/v1/bgg-sync`, {
          method: "POST",
          headers: {
            // Use service role key as bearer - bgg-sync will verify ownership
            // For cron, we impersonate the owner
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ library_id: lib.library_id }),
        });

        const data = await res.json().catch(() => ({}));
        results.push({
          library_id: lib.library_id,
          status: data.success ? "success" : "error",
          message: data.message || data.error,
        });

        // Rate limit between libraries to be gentle with BGG
        await new Promise((r) => setTimeout(r, 5000));
      } catch (err) {
        results.push({
          library_id: lib.library_id,
          status: "error",
          message: (err as Error).message,
        });
      }
    }

    console.log(`[BGGSyncCron] Complete:`, JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[BGGSyncCron] Fatal:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
