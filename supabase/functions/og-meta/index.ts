import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * OG Meta Server — serves HTML pages with proper OG meta tags for social media crawlers.
 * 
 * Social media bots (Twitter, Facebook, Discord) don't execute JavaScript,
 * so SPAs need a server-side endpoint to provide OG tags.
 * 
 * Usage: /functions/v1/og-meta?slug=my-library&path=/game/catan
 * 
 * On self-hosted: Nginx can detect bot user-agents and proxy to this function.
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const path = url.searchParams.get("path") || "/";

  if (!slug) {
    return new Response("Missing slug", { status: 400 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const siteUrl = Deno.env.get("SITE_URL") || "https://gametaverns.com";
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch library
    const { data: library } = await supabase
      .from("libraries")
      .select("id, name, slug, description, logo_url")
      .eq("slug", slug)
      .maybeSingle();

    if (!library) {
      return redirectToApp(slug, path, siteUrl);
    }

    const libraryUrl = `https://${slug}.gametaverns.com`;
    const ogImageUrl = `${siteUrl}/functions/v1/og-image?slug=${slug}`;

    // Check if this is a game detail page
    const gameSlugMatch = path.match(/^\/game\/(.+)$/);
    if (gameSlugMatch) {
      const gameSlug = gameSlugMatch[1];
      const { data: game } = await supabase
        .from("games")
        .select("title, description, image_url, min_players, max_players, play_time")
        .eq("library_id", library.id)
        .eq("slug", gameSlug)
        .maybeSingle();

      if (game) {
        const playerRange = game.min_players && game.max_players
          ? `${game.min_players}–${game.max_players} players`
          : null;
        const desc = game.description
          ? game.description.replace(/<[^>]+>/g, "").slice(0, 155)
          : `${game.title} in ${library.name}'s collection${playerRange ? ` • ${playerRange}` : ""}`;

        return renderOgPage({
          title: `${game.title} — ${library.name}`,
          description: desc,
          image: game.image_url || ogImageUrl,
          url: `${libraryUrl}/game/${gameSlug}`,
          siteName: "GameTaverns",
          redirectUrl: `${libraryUrl}/game/${gameSlug}`,
        });
      }
    }

    // Library index page
    const { count: gameCount } = await supabase
      .from("games").select("*", { count: "exact", head: true })
      .eq("library_id", library.id).eq("is_expansion", false);

    const desc = library.description
      || `${library.name}'s board game collection — ${gameCount || 0} games to browse, borrow, and play.`;

    return renderOgPage({
      title: `${library.name} — Board Game Collection`,
      description: desc.slice(0, 155),
      image: ogImageUrl,
      url: libraryUrl + path,
      siteName: "GameTaverns",
      redirectUrl: libraryUrl + path,
    });
  } catch (e) {
    console.error("[og-meta] Error:", e);
    return redirectToApp(slug, path, Deno.env.get("SITE_URL") || "https://gametaverns.com");
  }
}

interface OgPageData {
  title: string;
  description: string;
  image: string;
  url: string;
  siteName: string;
  redirectUrl: string;
}

function renderOgPage(data: OgPageData): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(data.title)}</title>
  <meta name="description" content="${escapeHtml(data.description)}"/>
  
  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(data.title)}"/>
  <meta property="og:description" content="${escapeHtml(data.description)}"/>
  <meta property="og:image" content="${escapeHtml(data.image)}"/>
  <meta property="og:url" content="${escapeHtml(data.url)}"/>
  <meta property="og:site_name" content="${escapeHtml(data.siteName)}"/>
  <meta property="og:type" content="website"/>
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${escapeHtml(data.title)}"/>
  <meta name="twitter:description" content="${escapeHtml(data.description)}"/>
  <meta name="twitter:image" content="${escapeHtml(data.image)}"/>
  
  <!-- Redirect non-bot users to the actual app -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(data.redirectUrl)}"/>
  <link rel="canonical" href="${escapeHtml(data.url)}"/>
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(data.redirectUrl)}">${escapeHtml(data.title)}</a>...</p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function redirectToApp(slug: string, path: string, siteUrl: string): Response {
  const target = `https://${slug}.gametaverns.com${path}`;
  return new Response(`Redirecting...`, {
    status: 302,
    headers: { ...corsHeaders, Location: target },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

if (import.meta.main) {
  Deno.serve(handler);
}
