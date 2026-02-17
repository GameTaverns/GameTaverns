import { createClient } from "npm:@supabase/supabase-js@2";
import { aiComplete, isAIConfigured, getAIProviderName } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Catalog Format Descriptions — Batch AI formatter for game_catalog entries
 *
 * Finds catalog entries whose descriptions lack the "Quick Gameplay Overview"
 * format and rewrites them using AI. Designed to run as a periodic batch job
 * or be triggered manually from the admin panel.
 *
 * POST { batchSize?: number, dryRun?: boolean }
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("API_EXTERNAL_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing env config" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth: accept service_role key OR admin user JWT
    const authHeader = req.headers.get("Authorization") || "";
    let isAuthorized = authHeader.includes(serviceKey);

    if (!isAuthorized) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
      if (anonKey && authHeader) {
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();
        if (user) {
          const adminClient = createClient(supabaseUrl, serviceKey);
          const { data: roleData } = await adminClient
            .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
          if (roleData) isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isAIConfigured()) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(body.batchSize || 5, 20);
    const dryRun = body.dryRun === true;

    // Find catalog entries that need formatting:
    // - Have a description
    // - Description does NOT contain "Quick Gameplay Overview"
    // - Description is not just personal notes (skip very short ones < 50 chars)
    const { data: entries, error: fetchErr } = await admin
      .from("game_catalog")
      .select("id, title, description, bgg_id")
      .not("description", "is", null)
      .not("description", "like", "%Quick Gameplay Overview%")
      .gt("description", "")  // not empty
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (fetchErr) {
      return new Response(JSON.stringify({ error: "Failed to fetch entries", details: fetchErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out very short personal notes
    const candidates = (entries || []).filter(e => e.description && e.description.length >= 50);

    if (candidates.length === 0) {
      return new Response(JSON.stringify({
        success: true, message: "No unformatted catalog descriptions found", updated: 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[catalog-format] Processing ${candidates.length} entries using ${getAIProviderName()}`);

    let updated = 0;
    const errors: string[] = [];
    const results: { title: string; status: string }[] = [];

    for (const entry of candidates) {
      try {
        console.log(`[catalog-format] Formatting: ${entry.title}`);

        const aiResult = await aiComplete({
          messages: [
            {
              role: "system",
              content: `You are a board game description editor. Rewrite the given description into this EXACT format:

1. Opening paragraph: 2-3 sentences about the game's theme and what makes it special/unique.
2. "## Quick Gameplay Overview" header
3. Bullet points with bold labels:
   - **Goal:** One sentence about how to win
   - **On Your Turn:** or **Each Round:** 3-5 bullet points describing the main actions (use - for sub-bullets)
   - **End Game:** One sentence (optional if obvious from Goal)
   - **Winner:** One sentence about scoring/victory
4. One optional closing sentence about the edition or components if relevant.

CRITICAL RULES:
- Total length: 150-250 words
- If the input is just personal notes or too short to describe gameplay, write a NEW description based on the game title
- Use proper markdown: ## for headers, **bold** for labels, - for bullet points
- Be factual and informative, not promotional
- Do NOT include any markdown code fences or JSON wrapping — return ONLY the formatted description text`
            },
            {
              role: "user",
              content: `Rewrite this description for the board game "${entry.title}":\n\n${entry.description}`
            }
          ],
          max_tokens: 800,
        });

        if (!aiResult.success) {
          console.error(`[catalog-format] AI error for ${entry.title}:`, aiResult.error);
          if (aiResult.rateLimited) {
            errors.push(`Rate limited at ${entry.title}`);
            results.push({ title: entry.title, status: "rate_limited" });
            break;
          }
          errors.push(`AI failed for ${entry.title}`);
          results.push({ title: entry.title, status: "ai_error" });
          continue;
        }

        let newDescription = aiResult.content?.trim();
        if (!newDescription) {
          errors.push(`Empty AI response for ${entry.title}`);
          results.push({ title: entry.title, status: "empty_response" });
          continue;
        }

        // Strip markdown code fences if the AI wrapped the output
        if (newDescription.startsWith("```")) {
          newDescription = newDescription.replace(/^```(?:markdown)?\n?/, "").replace(/\n?```$/, "").trim();
        }

        // Validate format
        if (!newDescription.includes("Quick Gameplay Overview")) {
          console.warn(`[catalog-format] Output missing format header for ${entry.title}, using anyway`);
        }

        if (dryRun) {
          console.log(`[catalog-format] DRY RUN — would update ${entry.title}:\n${newDescription.substring(0, 200)}...`);
          results.push({ title: entry.title, status: "dry_run" });
          updated++;
          continue;
        }

        const { error: updateErr } = await admin
          .from("game_catalog")
          .update({ description: newDescription })
          .eq("id", entry.id);

        if (updateErr) {
          errors.push(`Update failed for ${entry.title}: ${updateErr.message}`);
          results.push({ title: entry.title, status: "update_error" });
          continue;
        }

        updated++;
        results.push({ title: entry.title, status: "updated" });
        console.log(`[catalog-format] Updated: ${entry.title}`);

        // Delay between AI calls
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${entry.title}: ${msg}`);
        results.push({ title: entry.title, status: "error" });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      updated,
      processed: candidates.length,
      dryRun,
      results,
      errors: errors.length > 0 ? errors : undefined,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[catalog-format] Error:", error);
    return new Response(JSON.stringify({ error: "Processing failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
