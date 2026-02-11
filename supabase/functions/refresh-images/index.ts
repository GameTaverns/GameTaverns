import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Fetches the image URL from a BGG page by scraping directly (no Firecrawl needed).
 * This is faster and more reliable for just extracting images.
 */
async function fetchBGGImage(bggUrl: string): Promise<string | null> {
  try {
    // First, try fetching the BGG page directly and extracting og:image
    const pageRes = await fetch(bggUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    if (!pageRes.ok) {
      console.log(`BGG page returned ${pageRes.status} for ${bggUrl}`);
      return null;
    }

    const html = await pageRes.text();
    
    // Try og:image first (most reliable)
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (ogImageMatch && ogImageMatch[1]) {
      const imageUrl = ogImageMatch[1].trim();
      if (imageUrl.includes("cf.geekdo-images.com")) {
        return imageUrl;
      }
    }
    
    // Alternative og:image format
    const ogImageMatch2 = html.match(/<meta[^>]*content=["']([^"']*cf\.geekdo-images\.com[^"']*)["'][^>]*property=["']og:image["']/i);
    if (ogImageMatch2 && ogImageMatch2[1]) {
      return ogImageMatch2[1].trim();
    }

    // Try to find main image in the page
    const imageRegex = /https?:\/\/cf\.geekdo-images\.com[^\s"'<>]+/g;
    const images = html.match(imageRegex) || [];
    const uniqueImages = [...new Set(images)] as string[];
    
    // Filter out thumbnails and avatars
    const filtered = uniqueImages.filter((img: string) => 
      !/crop100|square30|100x100|150x150|_thumb|_avatar|_micro/i.test(img)
    );
    
    // Prioritize itemrep (main box image) and imagepage
    filtered.sort((a: string, b: string) => {
      const prio = (url: string) => {
        if (/_itemrep/i.test(url)) return 0;
        if (/_imagepage/i.test(url)) return 1;
        return 2;
      };
      return prio(a) - prio(b);
    });
    
    if (filtered.length > 0) {
      return filtered[0];
    }

    return null;
  } catch (e) {
    console.error(`Error fetching BGG image for ${bggUrl}:`, e);
    return null;
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the user's library
    const { data: library } = await supabaseAdmin
      .from("libraries")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();

    if (!library) {
      return new Response(
        JSON.stringify({ success: false, error: "You must own a library to refresh images" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const libraryId = body.library_id || library.id;
    const limit = body.limit || 50; // Process in batches
    const fixOpengraph = body.fix_opengraph !== false; // Default: also fix opengraph images

    // Find games that need image fixes:
    // 1. Games with bgg_url but no image_url (original behavior)
    // 2. Games with low-quality opengraph images (new behavior)
    let query = supabaseAdmin
      .from("games")
      .select("id, title, bgg_url, bgg_id, image_url")
      .eq("library_id", libraryId)
      .not("bgg_url", "is", null);

    if (fixOpengraph) {
      // Get games with missing OR opengraph images
      query = query.or("image_url.is.null,image_url.ilike.%__opengraph%,image_url.ilike.%fit-in/1200x630%");
    } else {
      query = query.is("image_url", null);
    }

    const { data: games, error: gamesError } = await query.limit(limit);

    if (gamesError) {
      return new Response(
        JSON.stringify({ success: false, error: gamesError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!games || games.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No games need image refresh", updated: 0, remaining: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${games.length} games for image refresh`);

    let updated = 0;
    let failed = 0;
    const results: { title: string; status: string }[] = [];

    for (const game of games) {
      if (!game.bgg_url && !game.bgg_id) continue;

      // Extract BGG ID from URL or use stored bgg_id
      const bggId = game.bgg_id || game.bgg_url?.match(/boardgame(?:expansion)?\/(\d+)/)?.[1];
      if (!bggId) {
        failed++;
        results.push({ title: game.title, status: "no_bgg_id" });
        continue;
      }

      // Use BGG thing XML API (fast, returns canonical high-quality image URL)
      let imageUrl: string | null = null;
      try {
        const xmlUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${bggId}`;
        const res = await fetch(xmlUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/xml",
          },
        });
        if (res.ok) {
          const xml = await res.text();
          const imgMatch = xml.match(/<image>([^<]+)<\/image>/);
          imageUrl = imgMatch?.[1] || null;
        }
      } catch (e) {
        console.error(`Failed to fetch thing XML for ${bggId}:`, e);
      }

      // Fallback to page scraping if XML failed
      if (!imageUrl) {
        imageUrl = await fetchBGGImage(game.bgg_url || `https://boardgamegeek.com/boardgame/${bggId}`);
      }
      
      if (imageUrl) {
        const { error: updateError } = await supabaseAdmin
          .from("games")
          .update({ image_url: imageUrl })
          .eq("id", game.id);

        if (updateError) {
          console.error(`Failed to update ${game.title}:`, updateError);
          failed++;
          results.push({ title: game.title, status: "update_failed" });
        } else {
          updated++;
          console.log(`Updated image for: ${game.title}`);
          results.push({ title: game.title, status: "success" });
        }
      } else {
        failed++;
        results.push({ title: game.title, status: "no_image_found" });
      }

      // Small delay to be nice to BGG API
      await new Promise(r => setTimeout(r, 200));
    }

    // Check if there are more games to process
    let remainingQuery = supabaseAdmin
      .from("games")
      .select("id", { count: "exact", head: true })
      .eq("library_id", libraryId)
      .not("bgg_url", "is", null);

    if (fixOpengraph) {
      remainingQuery = remainingQuery.or("image_url.is.null,image_url.ilike.%__opengraph%,image_url.ilike.%fit-in/1200x630%");
    } else {
      remainingQuery = remainingQuery.is("image_url", null);
    }

    const { count: remaining } = await remainingQuery;

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        failed,
        processed: games.length,
        remaining: remaining || 0,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Refresh images error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Failed to refresh images" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// For Lovable Cloud deployment
Deno.serve(handler);
