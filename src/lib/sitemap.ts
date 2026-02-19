import { supabase } from "@/integrations/backend/client";

const SITE_URL = "https://hobby-shelf-spark.lovable.app";

/**
 * Generates a sitemap.xml string from dynamic data.
 * Call this from a Vite plugin or standalone script — not a React component.
 */
export async function generateSitemap(): Promise<string> {
  const staticPages = [
    { url: "/", priority: "1.0", changefreq: "weekly" },
    { url: "/features", priority: "0.9", changefreq: "monthly" },
    { url: "/directory", priority: "0.8", changefreq: "daily" },
    { url: "/catalog", priority: "0.8", changefreq: "daily" },
  ];

  // Fetch public user profiles
  const { data: profiles } = await supabase
    .from("user_profiles_minimal")
    .select("username")
    .not("username", "is", null)
    .limit(5000);

  // Fetch public libraries
  const { data: libraries } = await supabase
    .from("libraries_public")
    .select("slug")
    .not("slug", "is", null)
    .limit(5000);

  const profileUrls = (profiles ?? []).map((p) => ({
    url: `/u/${p.username}`,
    priority: "0.6",
    changefreq: "weekly",
  }));

  const libraryUrls = (libraries ?? []).map((l) => ({
    url: `https://${l.slug}.gametaverns.app/`,
    priority: "0.7",
    changefreq: "weekly",
    absolute: true,
  }));

  const allPages = [...staticPages, ...profileUrls, ...libraryUrls];
  const today = new Date().toISOString().split("T")[0];

  const entries = allPages
    .map(
      (p) => `  <url>
    <loc>${(p as any).absolute ? p.url : `${SITE_URL}${p.url}`}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;
}
