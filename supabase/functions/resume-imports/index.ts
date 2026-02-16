import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Resume paused import jobs after a system update.
 * 
 * Called by update.sh after services are back up. For each paused job:
 * - BGG collection imports: re-triggers bulk-import with the same username
 *   (the skip-existing logic naturally picks up where it left off)
 * - CSV/BGG links imports: re-triggers with the stored item list
 *   (already-imported games are skipped)
 * 
 * Requires service_role authorization.
 */
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify service_role auth
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";
  
  if (!authHeader?.includes(serviceRoleKey) || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Unauthorized — requires service_role key" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("API_EXTERNAL_URL") || "";
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Find all paused jobs
  const { data: pausedJobs, error: fetchErr } = await supabase
    .from("import_jobs")
    .select("id, library_id, import_type, import_metadata, processed_items, total_items")
    .eq("status", "paused")
    .order("created_at", { ascending: true });

  if (fetchErr) {
    console.error("[ResumeImports] Failed to fetch paused jobs:", fetchErr);
    return new Response(
      JSON.stringify({ error: "Failed to fetch paused jobs", detail: fetchErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!pausedJobs || pausedJobs.length === 0) {
    console.log("[ResumeImports] No paused jobs to resume");
    return new Response(
      JSON.stringify({ resumed: 0, message: "No paused jobs found" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[ResumeImports] Found ${pausedJobs.length} paused job(s) to resume`);

  const results: { job_id: string; status: string; message: string }[] = [];

  for (const job of pausedJobs) {
    const metadata = job.import_metadata as Record<string, unknown> | null;
    
    if (!metadata) {
      // No metadata stored — can't resume, mark as failed
      await supabase
        .from("import_jobs")
        .update({
          status: "failed",
          error_message: "Cannot resume: no import metadata stored (job was created before pause/resume support)",
        })
        .eq("id", job.id);
      results.push({ job_id: job.id, status: "failed", message: "No metadata — marked as failed" });
      continue;
    }

    // Set job back to processing before triggering
    await supabase
      .from("import_jobs")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", job.id);

    // Build the re-trigger payload based on import type
    const mode = metadata.mode as string;
    const triggerPayload: Record<string, unknown> = {
      mode,
      library_id: job.library_id,
      enhance_with_bgg: metadata.enhance_with_bgg ?? true,
      enhance_with_ai: metadata.enhance_with_ai ?? false,
      default_options: metadata.default_options || undefined,
    };

    if (mode === "bgg_collection") {
      // For BGG collection: re-fetch with same username
      // The skip-existing logic in bulk-import will skip already-imported games
      const bggUsername = metadata.bgg_username as string;
      if (!bggUsername) {
        // Try to get username from library_settings
        const { data: settings } = await supabase
          .from("library_settings")
          .select("bgg_username")
          .eq("library_id", job.library_id)
          .single();
        triggerPayload.bgg_username = settings?.bgg_username || null;
      } else {
        triggerPayload.bgg_username = bggUsername;
      }

      if (!triggerPayload.bgg_username) {
        await supabase
          .from("import_jobs")
          .update({
            status: "failed",
            error_message: "Cannot resume BGG collection import: no username available",
          })
          .eq("id", job.id);
        results.push({ job_id: job.id, status: "failed", message: "No BGG username" });
        continue;
      }
    } else if (mode === "csv") {
      // For CSV: use stored items list
      const storedItems = metadata.items as Array<{ title: string; bgg_id?: string; bgg_url?: string }>;
      if (!storedItems || storedItems.length === 0) {
        await supabase
          .from("import_jobs")
          .update({
            status: "failed",
            error_message: "Cannot resume CSV import: no item data stored",
          })
          .eq("id", job.id);
        results.push({ job_id: job.id, status: "failed", message: "No stored items" });
        continue;
      }
      // Convert stored items to bgg_links format (simplest re-trigger path)
      // Items with bgg_id use links mode; items without need CSV mode
      // Since we're re-triggering, the skip-existing logic handles dedup
      triggerPayload.mode = "bgg_links";
      triggerPayload.bgg_links = storedItems
        .filter(item => item.bgg_url || item.bgg_id)
        .map(item => item.bgg_url || `https://boardgamegeek.com/boardgame/${item.bgg_id}`);
      
      // Items without BGG IDs can't be resumed via links — they need a re-upload
      const noIdItems = storedItems.filter(item => !item.bgg_url && !item.bgg_id);
      if (noIdItems.length > 0 && triggerPayload.bgg_links && (triggerPayload.bgg_links as string[]).length === 0) {
        await supabase
          .from("import_jobs")
          .update({
            status: "failed",
            error_message: `Cannot resume CSV import: ${noIdItems.length} items had no BGG ID. Please re-upload the CSV.`,
          })
          .eq("id", job.id);
        results.push({ job_id: job.id, status: "failed", message: "CSV items without BGG IDs" });
        continue;
      }
    } else if (mode === "bgg_links") {
      const storedItems = metadata.items as Array<{ title: string; bgg_id?: string; bgg_url?: string }>;
      if (!storedItems || storedItems.length === 0) {
        await supabase
          .from("import_jobs")
          .update({
            status: "failed",
            error_message: "Cannot resume BGG links import: no links stored",
          })
          .eq("id", job.id);
        results.push({ job_id: job.id, status: "failed", message: "No stored links" });
        continue;
      }
      triggerPayload.bgg_links = storedItems.map(item => item.bgg_url || `https://boardgamegeek.com/boardgame/${item.bgg_id}`);
    }

    // Fire-and-forget: trigger bulk-import as a new request
    // The old paused job stays in DB as a record; the new import creates its own job
    const functionsUrl = `${supabaseUrl}/functions/v1/bulk-import`;
    console.log(`[ResumeImports] Re-triggering job ${job.id} (${mode}) → ${functionsUrl}`);

    try {
      const triggerRes = await fetch(functionsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify(triggerPayload),
      });

      // Mark old paused job as superseded (a new job was created by bulk-import)
      await supabase
        .from("import_jobs")
        .update({
          status: "completed",
          error_message: `Resumed after system update — new import triggered (HTTP ${triggerRes.status})`,
        })
        .eq("id", job.id);

      results.push({
        job_id: job.id,
        status: "resumed",
        message: `Re-triggered as ${mode} (HTTP ${triggerRes.status})`,
      });
    } catch (e) {
      console.error(`[ResumeImports] Failed to trigger resume for job ${job.id}:`, e);
      await supabase
        .from("import_jobs")
        .update({
          status: "failed",
          error_message: `Resume failed: ${e instanceof Error ? e.message : "Unknown error"}`,
        })
        .eq("id", job.id);
      results.push({ job_id: job.id, status: "failed", message: e instanceof Error ? e.message : "Unknown" });
    }
  }

  console.log(`[ResumeImports] Done. Results:`, JSON.stringify(results));

  return new Response(
    JSON.stringify({ resumed: results.filter(r => r.status === "resumed").length, results }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
};

export default handler;

if (import.meta.main) {
  Deno.serve(handler);
}
