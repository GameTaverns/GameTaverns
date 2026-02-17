import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Fetches the BGG community average rating for a game via the XML API.
 * Returns the raw BGG 10-point scale rating (stored on game_catalog.bgg_community_rating).
 * Uses BGG session cookie if available to avoid rate-limiting/blocking.
 */
async function fetchBggRating(bggId: string): Promise<{ rating: number | null; error?: string }> {
  try {
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/xml",
      Referer: "https://boardgamegeek.com/",
      Origin: "https://boardgamegeek.com",
    };

    const bggCookie = Deno.env.get("BGG_SESSION_COOKIE");
    const bggToken = Deno.env.get("BGG_API_TOKEN");
    if (bggToken) headers["Authorization"] = `Bearer ${bggToken}`;
    if (bggCookie) headers["Cookie"] = bggCookie;

    const url = `https://boardgamegeek.com/xmlapi2/thing?id=${bggId}&stats=1`;
    const res = await fetch(url, { headers });

    if (res.status === 202) {
      // BGG returns 202 when data is being prepared — retry after delay
      return { rating: null, error: `202 (queued, retry later)` };
    }

    if (!res.ok) {
      return { rating: null, error: `HTTP ${res.status}` };
    }

    const xml = await res.text();

    // Check for empty/error responses
    if (xml.includes('<items total="0"') || xml.length < 100) {
      return { rating: null, error: "empty response" };
    }

    const match = xml.match(/<average\s+value="([^"]+)"/);
    if (!match) {
      return { rating: null, error: "no <average> tag found" };
    }

    const bggRating = parseFloat(match[1]);
    if (isNaN(bggRating) || bggRating <= 0) {
      return { rating: null, error: `invalid rating value: ${match[1]}` };
    }

    return { rating: bggRating };
  } catch (e) {
    return { rating: null, error: e instanceof Error ? e.message : "fetch error" };
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const limit = body.limit || 100;

    // Refresh BGG community ratings on the catalog
    const { data: catalogEntries, error: catalogError } = await supabaseAdmin
      .from("game_catalog")
      .select("id, title, bgg_id, bgg_community_rating")
      .not("bgg_id", "is", null)
      .is("bgg_community_rating", null)
      .limit(limit);

    if (catalogError) {
      return new Response(
        JSON.stringify({ error: catalogError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!catalogEntries || catalogEntries.length === 0) {
      return new Response(
        JSON.stringify({ updated: 0, processed: 0, remaining: 0, message: "All catalog entries already have BGG ratings" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[refresh-ratings] Processing ${catalogEntries.length} entries. BGG cookie: ${Deno.env.get("BGG_SESSION_COOKIE") ? "set" : "NOT set"}`);

    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    // Batch BGG IDs into groups of 20 (BGG API supports comma-separated IDs)
    const batchSize = 20;
    const batches: typeof catalogEntries[] = [];
    for (let i = 0; i < catalogEntries.length; i += batchSize) {
      batches.push(catalogEntries.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const bggIds = batch.map(e => e.bgg_id).filter(Boolean).join(",");
      
      try {
      const bggHeaders: Record<string, string> = {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/xml",
          Referer: "https://boardgamegeek.com/",
          Origin: "https://boardgamegeek.com",
        };

        const bggCookie = Deno.env.get("BGG_SESSION_COOKIE");
        const bggToken = Deno.env.get("BGG_API_TOKEN");
        if (bggToken) bggHeaders["Authorization"] = `Bearer ${bggToken}`;
        if (bggCookie) bggHeaders["Cookie"] = bggCookie;

        const url = `https://boardgamegeek.com/xmlapi2/thing?id=${bggIds}&stats=1`;
        let res = await fetch(url, { headers: bggHeaders });

        if (res.status === 202) {
          console.log(`[refresh-ratings] BGG returned 202 for batch, retrying after delay...`);
          await new Promise(r => setTimeout(r, 3000));
          // Retry once
          const retry = await fetch(url, { headers: bggHeaders });
          if (!retry.ok) {
            errors.push(`Batch ${bggIds.substring(0, 30)}... HTTP ${retry.status} on retry`);
            failed += batch.length;
            continue;
          }
          const xml = await retry.text();
          await processXmlBatch(xml, batch, supabaseAdmin, errors);
          const batchUpdated = batch.length - failed;
          // Count handled below
        } else if (!res.ok) {
          console.error(`[refresh-ratings] BGG HTTP ${res.status} for batch`);
          errors.push(`Batch HTTP ${res.status}`);
          failed += batch.length;
        } else {
          const xml = await res.text();
          const result = await processXmlBatch(xml, batch, supabaseAdmin, errors);
          updated += result.updated;
          failed += result.failed;
        }
      } catch (e) {
        console.error(`[refresh-ratings] Batch error:`, e);
        failed += batch.length;
      }

      // Rate-limit between batches
      await new Promise(r => setTimeout(r, 1000));
    }

    // Count remaining
    const { count: remaining } = await supabaseAdmin
      .from("game_catalog")
      .select("id", { count: "exact", head: true })
      .not("bgg_id", "is", null)
      .is("bgg_community_rating", null);

    console.log(`[refresh-ratings] Done: ${updated} updated, ${failed} failed, ${remaining || 0} remaining`);
    if (errors.length > 0) {
      console.log(`[refresh-ratings] Sample errors: ${errors.slice(0, 5).join("; ")}`);
    }

    return new Response(
      JSON.stringify({ updated, failed, processed: catalogEntries.length, remaining: remaining || 0, errors: errors.slice(0, 5) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Refresh ratings error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Failed to refresh ratings" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

/**
 * Parse a batched BGG XML response and update ratings for matching entries.
 */
async function processXmlBatch(
  xml: string,
  entries: { id: string; title: string; bgg_id: string | null }[],
  supabaseAdmin: ReturnType<typeof createClient>,
  errors: string[]
): Promise<{ updated: number; failed: number }> {
  let updated = 0;
  let failed = 0;

  // Extract all items with their ratings
  const itemRegex = /<item[^>]+id="(\d+)"[^>]*>[\s\S]*?<\/item>/g;
  const ratingMap = new Map<string, number>();

  let itemMatch;
  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const itemId = itemMatch[1];
    const itemXml = itemMatch[0];
    const avgMatch = itemXml.match(/<average\s+value="([^"]+)"/);
    if (avgMatch) {
      const val = parseFloat(avgMatch[1]);
      if (!isNaN(val) && val > 0) {
        ratingMap.set(itemId, val);
      }
    }
  }

  console.log(`[refresh-ratings] Parsed ${ratingMap.size} ratings from BGG XML (${entries.length} entries)`);

  for (const entry of entries) {
    if (!entry.bgg_id) { failed++; continue; }

    const rating = ratingMap.get(entry.bgg_id);
    if (rating !== undefined) {
      const { error: updateError } = await supabaseAdmin
        .from("game_catalog")
        .update({ bgg_community_rating: rating })
        .eq("id", entry.id);

      if (updateError) {
        errors.push(`DB update failed for ${entry.title}: ${updateError.message}`);
        failed++;
      } else {
        updated++;
      }
    } else {
      errors.push(`No rating found for BGG#${entry.bgg_id} (${entry.title})`);
      failed++;
    }
  }

  return { updated, failed };
}

// Self-hosted: export default for main router; guard prevents standalone server conflict
if (import.meta.main) {
  Deno.serve(handler);
}
