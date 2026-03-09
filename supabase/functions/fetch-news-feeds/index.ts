import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  author?: string;
  imageUrl?: string;
  guid?: string;
}

function extractImageFromContent(html: string): string | null {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] || null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}

function parseXmlTag(xml: string, tag: string): string {
  const openRe = new RegExp(`<${tag}[^>]*>`, "i");
  const closeRe = new RegExp(`</${tag}>`, "i");
  const openMatch = xml.match(openRe);
  const closeMatch = xml.match(closeRe);
  if (!openMatch || !closeMatch) return "";
  const start = openMatch.index! + openMatch[0].length;
  const end = closeMatch.index!;
  let content = xml.slice(start, end).trim();
  // Handle CDATA
  if (content.startsWith("<![CDATA[")) {
    content = content.slice(9, content.lastIndexOf("]]>")).trim();
  }
  return content;
}

function parseRssFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = parseXmlTag(itemXml, "title");
    const link = parseXmlTag(itemXml, "link");
    const description = parseXmlTag(itemXml, "description");
    const pubDate = parseXmlTag(itemXml, "pubDate");
    const author = parseXmlTag(itemXml, "dc:creator") || parseXmlTag(itemXml, "author");
    const guid = parseXmlTag(itemXml, "guid") || link;

    // Try media:content or enclosure for image
    let imageUrl: string | null = null;
    const mediaMatch = itemXml.match(/url=["']([^"']+\.(jpg|jpeg|png|webp|gif)[^"']*)/i);
    if (mediaMatch) imageUrl = mediaMatch[1];
    if (!imageUrl) imageUrl = extractImageFromContent(description);

    if (title && link) {
      items.push({ title, link, description, pubDate, author, imageUrl: imageUrl || undefined, guid });
    }
  }

  return items;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}

// Keyword-based auto-categorization
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "crowdfunding": ["kickstarter", "gamefound", "crowdfund", "crowdfunding", "pledge", "campaign", "backer", "back this", "funded"],
  "new-releases": ["release", "releasing", "released", "now available", "out now", "launch", "launches", "launching", "hits shelves", "in stores"],
  "reviews": ["review", "reviewed", "verdict", "our take", "worth it", "should you buy", "impressions"],
  "events": ["gencon", "gen con", "essen", "spiel", "pax unplugged", "convention", "event", "expo", "fair", "bgg.con", "bggcon", "dice tower con", "ukge"],
  "industry-news": ["acquisition", "acquired", "merger", "publisher", "studio", "company", "industry", "layoff", "hire", "partnership", "announces", "announcement"],
  "previews": ["preview", "first look", "sneak peek", "upcoming", "coming soon", "revealed", "reveal", "teaser"],
  "rumors": ["rumor", "rumour", "leak", "leaked", "speculation", "unconfirmed", "reportedly"],
  "deals": ["deal", "sale", "discount", "% off", "clearance", "bargain", "price drop", "coupon", "promo"],
};

function detectCategories(title: string, summary: string): string[] {
  const text = `${title} ${summary}`.toLowerCase();
  const matched: string[] = [];
  for (const [slug, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      matched.push(slug);
    }
  }
  // Default to industry-news if nothing matched
  if (matched.length === 0) matched.push("industry-news");
  return matched;
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("API_EXTERNAL_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all enabled RSS sources
    const { data: sources, error: srcErr } = await supabase
      .from("news_sources")
      .select("*")
      .eq("is_enabled", true)
      .eq("source_type", "rss")
      .not("feed_url", "is", null);

    if (srcErr) throw srcErr;

    let totalAdded = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    for (const source of sources || []) {
      try {
        // Check if we should fetch (based on interval)
        if (source.last_fetched_at) {
          const elapsed = Date.now() - new Date(source.last_fetched_at).getTime();
          if (elapsed < source.fetch_interval_minutes * 60 * 1000) {
            continue;
          }
        }

        // Fetch the RSS feed
        const response = await fetch(source.feed_url!, {
          headers: { "User-Agent": "GameTaverns/1.0 (News Aggregator)" },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const xml = await response.text();
        const items = parseRssFeed(xml);

        for (const item of items.slice(0, 25)) { // Limit per source per fetch
          const externalId = item.guid || item.link;
          const baseSlug = slugify(item.title);
          const slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;

          // Check for duplicates
          const { data: existing } = await supabase
            .from("news_articles")
            .select("id")
            .eq("source_id", source.id)
            .eq("external_id", externalId)
            .maybeSingle();

          if (existing) {
            totalSkipped++;
            continue;
          }

          const summary = stripHtml(item.description).slice(0, 500);
          const status = source.is_trusted ? "published" : "pending";
          const publishedAt = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();

          const { error: insertErr } = await supabase.from("news_articles").insert({
            source_id: source.id,
            title: item.title,
            slug,
            summary,
            content: item.description,
            content_format: "html",
            source_url: item.link,
            image_url: item.imageUrl || null,
            author_name: item.author || null,
            published_at: publishedAt,
            status,
            external_id: externalId,
          });

          if (insertErr) {
            if (insertErr.code === "23505") {
              totalSkipped++;
            } else {
              errors.push(`${source.name}: ${insertErr.message}`);
            }
          } else {
            totalAdded++;
          }
        }

        // Update last_fetched_at
        await supabase.from("news_sources").update({
          last_fetched_at: new Date().toISOString(),
          last_error: null,
        }).eq("id", source.id);

      } catch (err: any) {
        const errMsg = err.message || String(err);
        errors.push(`${source.name}: ${errMsg}`);
        await supabase.from("news_sources").update({
          last_fetched_at: new Date().toISOString(),
          last_error: errMsg,
        }).eq("id", source.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        added: totalAdded,
        skipped: totalSkipped,
        errors,
        sources_checked: sources?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
// Router mode (imported by main/)
export default handler;

// Standalone mode (direct deploy)
const isMainWorker = Deno.env.get("SUPABASE_FUNCTION_NAME") === "fetch-news-feeds";
if (isMainWorker) {
  serve(handler);
}
