import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOW_QUALITY = /__(geeklistimagebar|geeklistimage|square|mt|_t\b)|__square@2x/i;

/**
 * Fetch gallery images from BGG's internal JSON API.
 * Uses the same high-quality endpoint as bulk-import.
 */
async function fetchBGGGalleryImages(bggId: string, mainImageUrl?: string | null): Promise<string[]> {
  try {
    const url = `https://api.geekdo.com/api/images?ajax=1&gallery=all&nosession=1&objectid=${bggId}&objecttype=thing&pageid=1&showcount=50&sort=hot`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Referer": "https://boardgamegeek.com/",
      },
    });

    if (!res.ok) {
      console.warn(`[CatalogGalleryBackfill] BGG gallery API returned ${res.status} for ${bggId}`);
      return [];
    }

    const data = await res.json();
    const seen = new Set<string>();
    const categorized: { url: string; priority: number }[] = [];

    for (const img of (data.images || [])) {
      const rawUrl = img.imageurl_lg || img.imageurl || "";
      if (!rawUrl || !rawUrl.startsWith("https://cf.geekdo-images.com")) continue;
      const cleanUrl = rawUrl.replace(/\\\//g, "/");
      if (seen.has(cleanUrl)) continue;
      seen.add(cleanUrl);
      if (LOW_QUALITY.test(cleanUrl)) continue;
      if (mainImageUrl && cleanUrl === mainImageUrl) continue;

      const href = (img.imagepagehref || "").toLowerCase();
      const caption = (img.caption || "").toLowerCase();
      let priority = 5;
      if (href.includes("/play") || caption.includes("play") || caption.includes("gameplay")) priority = 1;
      else if (href.includes("/component") || caption.includes("component") || caption.includes("setup")) priority = 2;
      else if (href.includes("/custom") || caption.includes("custom") || caption.includes("painted")) priority = 3;
      else if (href.includes("/miscellaneous")) priority = 4;
      else if (href.includes("/boxfront") || href.includes("/box") || caption.includes("box")) priority = 6;

      categorized.push({ url: cleanUrl, priority });
    }

    categorized.sort((a, b) => a.priority - b.priority);
    return categorized.slice(0, 5).map(c => c.url);
  } catch (e) {
    console.error(`[CatalogGalleryBackfill] Gallery API error for ${bggId}:`, e);
    return [];
  }
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    const token = authHeader.replace("Bearer ", "").trim();

    // Check if token is service role or anon key (internal/cron calls)
    // Also check JWT role claim — anon key JWTs have role: "anon"
    let isInternalCall = token === serviceKey || token === anonKey;
    if (!isInternalCall) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        isInternalCall = payload.role === "anon" || payload.role === "service_role";
      } catch { /* not a JWT, fall through */ }
    }

    if (!isInternalCall) {
      // Validate user is admin via JWT
      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        anonKey,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (!user) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid authentication" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: roleData } = await supabaseAdmin
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!roleData) {
        return new Response(
          JSON.stringify({ success: false, error: "Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!isInternalCall) {
      // Validate user is admin via JWT
      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        anonKey,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (!user) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid authentication" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: roleData } = await supabaseAdmin
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!roleData) {
        return new Response(
          JSON.stringify({ success: false, error: "Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(body.limit || 50, 200);
    const forceRefresh = body.force_refresh === true; // If true, re-fetch even if already has images

    // Find catalog entries with bgg_id but missing (or empty) additional_images
    let query = supabaseAdmin
      .from("game_catalog")
      .select("id, bgg_id, title, image_url, additional_images")
      .not("bgg_id", "is", null);

    if (!forceRefresh) {
      // Only entries without gallery images
      query = query.or("additional_images.is.null,additional_images.eq.{}");
    }

    const { data: entries, error } = await query.limit(limit);

    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!entries || entries.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No catalog entries need gallery backfill", updated: 0, remaining: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[CatalogGalleryBackfill] Processing ${entries.length} catalog entries`);

    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const results: { title: string; bgg_id: string; status: string; count: number }[] = [];

    for (const entry of entries) {
      if (!entry.bgg_id) { skipped++; continue; }

      try {
        const images = await fetchBGGGalleryImages(entry.bgg_id, entry.image_url);

        if (images.length === 0) {
          skipped++;
          results.push({ title: entry.title, bgg_id: entry.bgg_id, status: "no_images_found", count: 0 });
        } else {
          const { error: updateError } = await supabaseAdmin
            .from("game_catalog")
            .update({ additional_images: images })
            .eq("id", entry.id);

          if (updateError) {
            console.error(`[CatalogGalleryBackfill] Failed to update ${entry.title}:`, updateError);
            failed++;
            results.push({ title: entry.title, bgg_id: entry.bgg_id, status: "update_failed", count: 0 });
          } else {
            updated++;
            console.log(`[CatalogGalleryBackfill] Updated ${entry.title} with ${images.length} images`);
            results.push({ title: entry.title, bgg_id: entry.bgg_id, status: "success", count: images.length });
          }
        }
      } catch (e) {
        console.error(`[CatalogGalleryBackfill] Error processing ${entry.title}:`, e);
        failed++;
        results.push({ title: entry.title, bgg_id: entry.bgg_id, status: "error", count: 0 });
      }

      // Small delay to be polite to BGG API
      await new Promise(r => setTimeout(r, 100));
    }

    // Count remaining entries without gallery images
    const { count: remaining } = await supabaseAdmin
      .from("game_catalog")
      .select("id", { count: "exact", head: true })
      .not("bgg_id", "is", null)
      .or("additional_images.is.null,additional_images.eq.{}");

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        skipped,
        failed,
        processed: entries.length,
        remaining: remaining || 0,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[CatalogGalleryBackfill] Error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Failed to backfill gallery images" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

export default handler;

if (import.meta.main) {
  Deno.serve(handler);
}
