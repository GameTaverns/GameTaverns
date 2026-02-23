import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://gametaverns.com";

function url(loc: string, priority: string, changefreq: string, lastmod?: string): string {
  return `  <url>
    <loc>${loc}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}
  </url>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  const today = new Date().toISOString().split("T")[0];

  // Static routes
  const staticUrls = [
    url(`${BASE_URL}/`, "1.0", "weekly", today),
    url(`${BASE_URL}/features`, "0.8", "monthly"),
    url(`${BASE_URL}/directory`, "0.9", "daily"),
    url(`${BASE_URL}/catalog`, "0.9", "daily"),
    url(`${BASE_URL}/catalog/mechanics`, "0.8", "weekly"),
    // Player count pages
    ...[1,2,3,4,5,6,7,8].map((n) =>
      url(`${BASE_URL}/games-for-${n}-players`, "0.8", "weekly")
    ),
  ];

  // Catalog games
  const { data: catalogGames } = await supabase
    .from("game_catalog")
    .select("slug, updated_at")
    .not("slug", "is", null)
    .limit(5000);

  const catalogUrls = (catalogGames || []).map((g) =>
    url(`${BASE_URL}/catalog/${g.slug}`, "0.7", "monthly", g.updated_at?.split("T")[0])
  );

  // Public libraries — indexed as subdomain URLs
  const { data: libraries } = await supabase
    .from("libraries_public")
    .select("slug, name, updated_at")
    .limit(1000);

  const libraryUrls = (libraries || []).map((l) =>
    url(`https://${l.slug}.gametaverns.app/`, "0.8", "weekly", l.updated_at?.split("T")[0])
  );

  // Mechanics
  const { data: mechanics } = await supabase
    .from("mechanics")
    .select("name");

  const mechanicUrls = (mechanics || []).map((m) => {
    const slug = m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return url(`${BASE_URL}/catalog/mechanic/${slug}`, "0.7", "weekly");
  });

  // User profiles (public)
  const { data: profiles } = await supabase
    .from("public_user_profiles")
    .select("username")
    .not("username", "is", null)
    .limit(5000);

  const profileUrls = (profiles || [])
    .filter((p) => p.username)
    .map((p) => url(`${BASE_URL}/u/${p.username}`, "0.5", "weekly"));

  // City-based library pages
  const { data: cityLibraries } = await supabase
    .from("library_directory")
    .select("location_city")
    .not("location_city", "is", null);

  const citySet = new Set<string>();
  (cityLibraries || []).forEach((lib: any) => {
    const slug = (lib.location_city || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (slug) citySet.add(slug);
  });
  const cityUrls = [...citySet].map((slug) =>
    url(`${BASE_URL}/libraries/${slug}`, "0.7", "weekly")
  );

  // Growth pages
  const growthUrls = [
    url(`${BASE_URL}/referrals`, "0.6", "monthly"),
  ];

  const allUrls = [...staticUrls, ...catalogUrls, ...libraryUrls, ...mechanicUrls, ...profileUrls, ...cityUrls, ...growthUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      ...corsHeaders,
    },
  });
});
