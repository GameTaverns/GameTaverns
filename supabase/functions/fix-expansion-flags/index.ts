import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Optional: pass dry_run=true to preview without changing anything
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") === "true";

  console.log(`[FixExpansions] Starting audit (dry_run=${dryRun})`);

  // 1. Fetch all games marked as expansion with no parent
  const { data: orphans, error } = await supabase
    .from("games")
    .select("id, title, bgg_id, library_id, is_expansion")
    .eq("is_expansion", true)
    .is("parent_game_id", null)
    .not("bgg_id", "is", null)
    .order("title");

  if (error) {
    console.error("[FixExpansions] Query error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[FixExpansions] Found ${orphans?.length || 0} orphaned expansions with BGG IDs`);

  const results = {
    total: orphans?.length || 0,
    corrected_to_base_game: [] as { id: string; title: string; bgg_id: string }[],
    linked_to_parent: [] as { id: string; title: string; parent_title: string }[],
    confirmed_expansion_no_parent: [] as { id: string; title: string; bgg_id: string }[],
    bgg_api_errors: [] as { id: string; title: string; bgg_id: string; error: string }[],
  };

  if (!orphans || orphans.length === 0) {
    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Process in batches of 20 BGG IDs (BGG API supports comma-separated)
  const batchSize = 20;
  for (let i = 0; i < orphans.length; i += batchSize) {
    const batch = orphans.slice(i, i + batchSize);
    const bggIds = batch.map((g) => g.bgg_id).join(",");

    try {
      const res = await fetch(
        `https://boardgamegeek.com/xmlapi2/thing?id=${bggIds}&stats=1`,
        {
          headers: {
            "User-Agent": "GameTaverns/1.0 (expansion-fix-script)",
            Accept: "application/xml, text/xml, */*",
          },
        }
      );

      if (!res.ok) {
        console.warn(`[FixExpansions] BGG API returned ${res.status} for batch starting at ${i}`);
        for (const g of batch) {
          results.bgg_api_errors.push({
            id: g.id,
            title: g.title,
            bgg_id: g.bgg_id!,
            error: `HTTP ${res.status}`,
          });
        }
        await sleep(5000);
        continue;
      }

      const xml = await res.text();

      if (xml.includes("Please try again later") || xml.includes("<message>")) {
        console.warn("[FixExpansions] BGG rate limited, waiting 10s...");
        await sleep(10000);
        // Retry this batch
        i -= batchSize;
        continue;
      }

      // Parse each <item> from the response
      const itemRegex = /<item[^>]*id="(\d+)"[^>]*type="([^"]+)"[^>]*>[\s\S]*?<\/item>/g;
      const itemMap = new Map<string, { type: string; xml: string }>();
      let match;
      while ((match = itemRegex.exec(xml)) !== null) {
        itemMap.set(match[1], { type: match[2], xml: match[0] });
      }

      for (const game of batch) {
        const bggInfo = itemMap.get(game.bgg_id!);
        if (!bggInfo) {
          results.bgg_api_errors.push({
            id: game.id,
            title: game.title,
            bgg_id: game.bgg_id!,
            error: "Not found in BGG response",
          });
          continue;
        }

        const isActuallyExpansion = bggInfo.type === "boardgameexpansion";

        if (!isActuallyExpansion) {
          // FALSE POSITIVE — this is a base game
          console.log(`[FixExpansions] CORRECTING: "${game.title}" (BGG ${game.bgg_id}) is NOT an expansion`);
          results.corrected_to_base_game.push({
            id: game.id,
            title: game.title,
            bgg_id: game.bgg_id!,
          });

          if (!dryRun) {
            await supabase
              .from("games")
              .update({ is_expansion: false })
              .eq("id", game.id);
          }
        } else {
          // It IS an expansion — try to find parent via BGG links
          const parentLinkMatch = bggInfo.xml.match(
            /<link[^>]*type="boardgameexpansion"[^>]*id="(\d+)"[^>]*inbound="true"/
          );
          // Alternative format
          const parentLinkMatch2 = !parentLinkMatch
            ? bggInfo.xml.match(
                /<link[^>]*inbound="true"[^>]*type="boardgameexpansion"[^>]*id="(\d+)"/
              )
            : null;
          const parentBggId = parentLinkMatch?.[1] || parentLinkMatch2?.[1];

          if (parentBggId) {
            // Find the parent game in the same library
            const { data: parentGame } = await supabase
              .from("games")
              .select("id, title")
              .eq("bgg_id", parentBggId)
              .eq("library_id", game.library_id!)
              .eq("is_expansion", false)
              .maybeSingle();

            if (parentGame) {
              console.log(
                `[FixExpansions] LINKING: "${game.title}" → parent "${parentGame.title}"`
              );
              results.linked_to_parent.push({
                id: game.id,
                title: game.title,
                parent_title: parentGame.title,
              });

              if (!dryRun) {
                await supabase
                  .from("games")
                  .update({ parent_game_id: parentGame.id })
                  .eq("id", game.id);
              }
            } else {
              results.confirmed_expansion_no_parent.push({
                id: game.id,
                title: game.title,
                bgg_id: game.bgg_id!,
              });
            }
          } else {
            results.confirmed_expansion_no_parent.push({
              id: game.id,
              title: game.title,
              bgg_id: game.bgg_id!,
            });
          }
        }
      }
    } catch (err) {
      console.error(`[FixExpansions] Fetch error for batch at ${i}:`, err);
      for (const g of batch) {
        results.bgg_api_errors.push({
          id: g.id,
          title: g.title,
          bgg_id: g.bgg_id!,
          error: String(err),
        });
      }
    }

    // Rate limit: wait between batches
    if (i + batchSize < orphans.length) {
      await sleep(2000);
    }
  }

  console.log(`[FixExpansions] Complete:
    Corrected to base game: ${results.corrected_to_base_game.length}
    Linked to parent: ${results.linked_to_parent.length}
    Confirmed expansion (no parent in library): ${results.confirmed_expansion_no_parent.length}
    API errors: ${results.bgg_api_errors.length}`);

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
