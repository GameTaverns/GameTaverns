import { createClient } from "npm:@supabase/supabase-js@2";
import { aiComplete, isAIConfigured, getAIProviderName } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Enum constants (unified across Cloud and Self-hosted)
// ---------------------------------------------------------------------------

const DIFFICULTY_LEVELS = [
  "1 - Light",
  "2 - Medium Light",
  "3 - Medium",
  "4 - Medium Heavy",
  "5 - Heavy",
] as const;

const PLAY_TIME_OPTIONS = [
  "0-15 Minutes",
  "15-30 Minutes",
  "30-45 Minutes",
  "45-60 Minutes",
  "60+ Minutes",
  "2+ Hours",
  "3+ Hours",
] as const;

const GAME_TYPE_OPTIONS = [
  "Board Game",
  "Card Game",
  "Dice Game",
  "Party Game",
  "War Game",
  "Miniatures",
  "RPG",
  "Other",
] as const;

// Self-hosted detection (used only for Discord deadlock prevention)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const IS_SELF_HOSTED =
  SUPABASE_URL.startsWith("http://") ||
  SUPABASE_URL.includes("kong") ||
  SUPABASE_URL.includes("localhost") ||
  SUPABASE_URL.includes("127.0.0.1");

// ---------------------------------------------------------------------------
// BGG XML API Helper (fast, reliable)
// ---------------------------------------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Decode HTML entities from BGG XML data
const decodeHtmlEntities = (input: string) =>
  input
    .replace(/&#10;/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_m, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCharCode(n) : _m;
    });

// Shared XML parsing logic
function parseBggXml(xml: string, bggId: string): {
  bgg_id: string;
  title?: string;
  image_url?: string;
  description?: string;
  min_players?: number;
  max_players?: number;
  suggested_age?: string;
  play_time?: string;
  difficulty?: string;
  mechanics?: string[];
  publisher?: string;
  designers?: string[];
  artists?: string[];
  is_expansion?: boolean;
  bgg_average_rating?: number;
} {
  if (!xml.includes("<item")) return { bgg_id: bggId };

  const titleMatch = xml.match(/<name[^>]*\btype="primary"[^>]*\bvalue="([^"]+)"/);
  const imageMatch = xml.match(/<image>([^<]+)<\/image>/);
  const descMatch = xml.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
  const minPlayersMatch = xml.match(/<minplayers[^>]*value="(\d+)"/);
  const maxPlayersMatch = xml.match(/<maxplayers[^>]*value="(\d+)"/);
  const minAgeMatch = xml.match(/<minage[^>]*value="(\d+)"/);
  const playTimeMatch = xml.match(/<playingtime[^>]*value="(\d+)"/);
  const weightMatch = xml.match(/<averageweight[^>]*value="([\d.]+)"/);
  const typeMatch = xml.match(/<item[^>]*type="([^"]+)"/);
  const avgRatingMatch = xml.match(/<average[^>]*value="([\d.]+)"/);
  let bgg_average_rating: number | undefined;
  if (avgRatingMatch) {
    const r = parseFloat(avgRatingMatch[1]);
    if (r > 0) bgg_average_rating = r;
  }
  const mechanicsMatches = xml.matchAll(/<link[^>]*type="boardgamemechanic"[^>]*value="([^"]+)"/g);
  const mechanics = [...mechanicsMatches].map((m) => m[1]);
  const publisherMatch = xml.match(/<link[^>]*type="boardgamepublisher"[^>]*value="([^"]+)"/);

  // Extract designers and artists
  const designerMatches = xml.matchAll(/<link[^>]*type="boardgamedesigner"[^>]*value="([^"]+)"/g);
  const designers = [...designerMatches].map((m) => decodeHtmlEntities(m[1]));
  const artistMatches = xml.matchAll(/<link[^>]*type="boardgameartist"[^>]*value="([^"]+)"/g);
  const artists = [...artistMatches].map((m) => decodeHtmlEntities(m[1]));

  let difficulty: string | undefined;
  if (weightMatch) {
    const w = parseFloat(weightMatch[1]);
    if (w > 0) {
      if (w < 1.5) difficulty = "1 - Light";
      else if (w < 2.25) difficulty = "2 - Medium Light";
      else if (w < 3.0) difficulty = "3 - Medium";
      else if (w < 3.75) difficulty = "4 - Medium Heavy";
      else difficulty = "5 - Heavy";
    }
  }

  let play_time: string | undefined;
  if (playTimeMatch) {
    const minutes = parseInt(playTimeMatch[1], 10);
    if (minutes <= 15) play_time = "0-15 Minutes";
    else if (minutes <= 30) play_time = "15-30 Minutes";
    else if (minutes <= 45) play_time = "30-45 Minutes";
    else if (minutes <= 60) play_time = "45-60 Minutes";
    else if (minutes <= 120) play_time = "60+ Minutes";
    else if (minutes <= 180) play_time = "2+ Hours";
    else play_time = "3+ Hours";
  }

  const decodeEntities = decodeHtmlEntities;

  let description: string | undefined;
  if (descMatch && descMatch[1]) {
    description = decodeEntities(descMatch[1]).trim();
    if (description.length > 5000) description = description.slice(0, 5000);
  }

  const isExpansion = typeMatch?.[1] === "boardgameexpansion";

  console.log(`[GameImport] BGG XML extracted data for ${bggId} (desc=${description?.length || 0} chars, expansion=${isExpansion}, bgg_rating=${bgg_average_rating || 'N/A'}, designers=${designers.length}, artists=${artists.length})`);

  return {
    bgg_id: bggId,
    title: titleMatch?.[1] ? decodeEntities(titleMatch[1]) : undefined,
    image_url: imageMatch?.[1],
    description,
    min_players: minPlayersMatch ? parseInt(minPlayersMatch[1], 10) : undefined,
    max_players: maxPlayersMatch ? parseInt(maxPlayersMatch[1], 10) : undefined,
    suggested_age: minAgeMatch ? `${minAgeMatch[1]}+` : undefined,
    play_time,
    difficulty,
    mechanics: mechanics.length > 0 ? mechanics : undefined,
    publisher: publisherMatch?.[1] ? decodeEntities(publisherMatch[1]) : undefined,
    designers: designers.length > 0 ? designers : undefined,
    artists: artists.length > 0 ? artists : undefined,
    is_expansion: isExpansion,
    bgg_average_rating,
  };
}

/**
 * Fetch additional gallery images from BGG's internal JSON API.
 * Returns up to 5 sanitized high-quality image URLs.
 * Filter out tiny thumbnails and known low-quality BGG variants.
 * Uses BGG's internal gallery JSON API (same as bulk-import for consistency).
 */
async function fetchBggGalleryImages(bggId: string, mainImageUrl?: string | null): Promise<string[]> {
  // Known low-quality/corrupt BGG image variants to skip
  const LOW_QUALITY = /__(geeklistimagebar|geeklistimage|square|mt|_t\b)|__square@2x/i;
  try {
    // Use the gallery=all endpoint with hot sort - returns high-quality imageurl_lg variants
    const url = `https://api.geekdo.com/api/images?ajax=1&gallery=all&nosession=1&objectid=${bggId}&objecttype=thing&pageid=1&showcount=50&sort=hot`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Referer": "https://boardgamegeek.com/",
      },
    });
    if (!res.ok) {
      console.warn(`[GameImport] BGG gallery API returned ${res.status} for ${bggId}`);
      return [];
    }
    const data = await res.json();
    const seen = new Set<string>();

    // Categorize images by type (gameplay preferred over box art)
    const categorized: { url: string; priority: number }[] = [];
    for (const img of (data.images || [])) {
      const url = img.imageurl_lg || img.imageurl || "";
      if (!url || !url.startsWith("https://cf.geekdo-images.com")) continue;
      const cleanUrl = url.replace(/\\\//g, "/");
      if (seen.has(cleanUrl)) continue;
      seen.add(cleanUrl);
      if (LOW_QUALITY.test(cleanUrl)) continue;
      if (cleanUrl === mainImageUrl) continue;

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
    console.error(`[GameImport] BGG gallery API error for ${bggId}:`, e);
    return [];
  }
}

async function fetchBGGDataFromXML(
  bggId: string
): Promise<{
  bgg_id: string;
  title?: string;
  image_url?: string;
  description?: string;
  min_players?: number;
  max_players?: number;
  suggested_age?: string;
  play_time?: string;
  difficulty?: string;
  mechanics?: string[];
  publisher?: string;
  designers?: string[];
  artists?: string[];
  is_expansion?: boolean;
  bgg_average_rating?: number;
}> {
  const bggCookie = Deno.env.get("BGG_SESSION_COOKIE") || Deno.env.get("BGG_COOKIE") || Deno.env.get("BGG_API_TOKEN") || "";
  const baseHeaders: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "application/xml, text/xml, */*",
  };

  const xmlUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${bggId}&stats=1`;
  const jinaApiKey = Deno.env.get("JINA_API_KEY") || "";
  const maxAttempts = 3; // Reduced since we have Jina fallback

  // Try direct BGG XML API first
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(xmlUrl, { headers: baseHeaders });

      if (!res.ok) {
        await res.text().catch(() => {});
        console.warn(`[GameImport] BGG XML API returned ${res.status} for ${bggId} (attempt ${attempt}/${maxAttempts})`);
        
        // If 401/403, try with cookie
        if ((res.status === 401 || res.status === 403) && bggCookie) {
          const cookieHeaders = { ...baseHeaders, Cookie: bggCookie };
          const retryRes = await fetch(xmlUrl, { headers: cookieHeaders });
          if (retryRes.ok) {
            const xml = await retryRes.text();
            if (xml.includes("<item")) {
              return parseBggXml(xml, bggId);
            }
          } else {
            await retryRes.text().catch(() => {});
          }
        }
        
        if (attempt < maxAttempts) {
          await sleep(Math.min(1000 * attempt, 3000));
          continue;
        }
        break; // Fall through to Jina
      }

      const xml = await res.text();
      const retryable =
        xml.includes("Please try again later") ||
        xml.includes("Your request has been accepted") ||
        xml.includes("<message>") ||
        !xml.includes("<item");

      if (retryable && attempt < maxAttempts) {
        await sleep(Math.min(750 * attempt, 3000));
        continue;
      }

      if (!retryable) {
        return parseBggXml(xml, bggId);
      }
      break; // Fall through to Jina
    } catch (e) {
      console.error("[GameImport] BGG XML error:", e);
      if (attempt < maxAttempts) {
        await sleep(Math.min(750 * attempt, 3000));
        continue;
      }
      break;
    }
  }

  // ---------------------------------------------------------------------------
  // Jina proxy fallback: fetch BGG XML via Jina Reader (bypasses IP block)
  // ---------------------------------------------------------------------------
  console.log(`[GameImport] Direct BGG failed, trying Jina proxy for XML API (${bggId})`);
  try {
    const jinaHeaders: Record<string, string> = {
      "Accept": "text/plain",
      "X-Return-Format": "text",
    };
    if (jinaApiKey) {
      jinaHeaders["Authorization"] = `Bearer ${jinaApiKey}`;
    }
    const jinaRes = await fetch(`https://r.jina.ai/${xmlUrl}`, { headers: jinaHeaders });
    if (jinaRes.ok) {
      const content = await jinaRes.text();
      if (content.includes("<item")) {
        console.log(`[GameImport] Jina proxy returned valid XML for ${bggId}`);
        return parseBggXml(content, bggId);
      }
      console.warn(`[GameImport] Jina proxy returned content but no <item> tag`);
    } else {
      await jinaRes.text().catch(() => {});
      console.warn(`[GameImport] Jina proxy returned ${jinaRes.status} for XML`);
    }
  } catch (jinaErr) {
    console.error("[GameImport] Jina XML proxy error:", jinaErr);
  }

  // Try Jina to fetch the BGG HTML page (og:title/image extraction)
  console.log(`[GameImport] Trying Jina proxy for BGG HTML page (${bggId})`);
  try {
    const bggPageUrl = `https://boardgamegeek.com/boardgame/${bggId}`;
    const jinaHeaders: Record<string, string> = {
      "Accept": "text/plain",
      "X-Return-Format": "html",
    };
    if (jinaApiKey) {
      jinaHeaders["Authorization"] = `Bearer ${jinaApiKey}`;
    }
    const jinaHtmlRes = await fetch(`https://r.jina.ai/${bggPageUrl}`, { headers: jinaHeaders });
    if (jinaHtmlRes.ok) {
      const html = await jinaHtmlRes.text();
      const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
                           html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/i);
      const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                           html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
      const ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i) ||
                          html.match(/<meta\s+content="([^"]+)"\s+property="og:description"/i);
      const titleTagMatch = html.match(/<title>([^<]+)<\/title>/i);
      const title = ogTitleMatch?.[1] || titleTagMatch?.[1]?.replace(/\s*\|.*$/, '').replace(/\s*\u2014.*$/, '').trim();
      
      if (title) {
        console.log(`[GameImport] Jina HTML proxy got title: ${title}`);
        // Only detect expansion if the page's item type explicitly says boardgameexpansion
        // (avoid false positives from nav links, sidebars, etc.)
        const itemTypeMatch = html.match(/<meta\s+property="og:type"\s+content="([^"]+)"/i) ||
                              html.match(/infobox[^>]*type[^>]*boardgameexpansion/i);
        const isExpansion = itemTypeMatch ? /boardgameexpansion/i.test(itemTypeMatch[1] || itemTypeMatch[0]) : false;
        // Use pickBestGeekdoImage for high-quality box art instead of og:image social crops
        const bestImage = pickBestGeekdoImage(html);
        // Only use og:image as last resort, and reject opengraph crops
        let fallbackImage = ogImageMatch?.[1] || null;
        if (fallbackImage && /__opengraph|fit-in\/1200x630|__small|__thumb/i.test(fallbackImage)) {
          fallbackImage = null;
        }
        return {
          bgg_id: bggId,
          title,
          image_url: bestImage || fallbackImage,
          description: ogDescMatch?.[1] || `${title} - imported from BoardGameGeek`,
          is_expansion: isExpansion,
        };
      }
      console.warn(`[GameImport] Jina HTML proxy returned no title`);
    } else {
      await jinaHtmlRes.text().catch(() => {});
      console.warn(`[GameImport] Jina HTML proxy returned ${jinaHtmlRes.status}`);
    }
  } catch (jinaHtmlErr) {
    console.error("[GameImport] Jina HTML proxy error:", jinaHtmlErr);
  }

  console.error(`[GameImport] All BGG data sources failed for ${bggId}`);
  return { bgg_id: bggId };
}

// ---------------------------------------------------------------------------
// Enum normalization helpers
// ---------------------------------------------------------------------------
const normalizeEnum = (value: string | undefined, allowed: readonly string[]): string | undefined => {
  if (!value) return undefined;
  const v = value.trim();
  return allowed.includes(v) ? v : undefined;
};

const normalizeDifficulty = (difficulty: string | undefined): string | undefined => {
  if (!difficulty) return undefined;
  const d = difficulty.trim();
  return normalizeEnum(d, DIFFICULTY_LEVELS);
};

const normalizePlayTime = (playTime: string | undefined): string | undefined => {
  if (!playTime) return undefined;
  const p = playTime.trim();
  const direct = normalizeEnum(p, PLAY_TIME_OPTIONS);
  if (direct) return direct;

  // Legacy self-hosted values → unified values
  const legacyMap: Record<string, string> = {
    "Under 30 Minutes": "15-30 Minutes",
    "60-90 Minutes": "60+ Minutes",
    "90-120 Minutes": "2+ Hours",
    "2-3 Hours": "2+ Hours",
  };
  const mapped = legacyMap[p];
  return mapped ? normalizeEnum(mapped, PLAY_TIME_OPTIONS) : undefined;
};

const normalizeGameType = (gameType: string | undefined): string | undefined => {
  if (!gameType) return undefined;
  const t = gameType.trim();
  const direct = normalizeEnum(t, GAME_TYPE_OPTIONS);
  if (direct) return direct;

  // Legacy self-hosted values → unified values
  const legacyMap: Record<string, string> = {
    "Miniatures Game": "Miniatures",
    "Role-Playing Game": "RPG",
    "Strategy Game": "Other",
    "Cooperative Game": "Other",
    "Deck Building": "Other",
    "Area Control": "Other",
    "Worker Placement": "Other",
  };
  const mapped = legacyMap[t];
  return mapped ? normalizeEnum(mapped, GAME_TYPE_OPTIONS) : undefined;
};

// ---------------------------------------------------------------------------
// Catalog upsert helper - seeds game_catalog from BGG data on every import
// ---------------------------------------------------------------------------
async function upsertCatalogEntry(
  supabaseAdmin: ReturnType<typeof createClient>,
  bggId: string,
  bggData: {
    title?: string;
    image_url?: string;
    additional_images?: string[];
    description?: string;
    min_players?: number;
    max_players?: number;
    suggested_age?: string;
    play_time?: string;
    difficulty?: string;
    mechanics?: string[];
    publisher?: string;
    designers?: string[];
    artists?: string[];
    is_expansion?: boolean;
    bgg_average_rating?: number;
  },
  gameId: string
): Promise<void> {
  if (!bggData.title) return;

  try {
    // Parse weight from difficulty string
    let weight: number | null = null;
    if (bggData.difficulty) {
      const weightMap: Record<string, number> = {
        "1 - Light": 1.25,
        "2 - Medium Light": 1.88,
        "3 - Medium": 2.63,
        "4 - Medium Heavy": 3.38,
        "5 - Heavy": 4.25,
      };
      weight = weightMap[bggData.difficulty] || null;
    }

    // Parse play_time_minutes from play_time enum
    let playTimeMinutes: number | null = null;
    if (bggData.play_time) {
      const timeMap: Record<string, number> = {
        "0-15 Minutes": 15,
        "15-30 Minutes": 30,
        "30-45 Minutes": 45,
        "45-60 Minutes": 60,
        "60+ Minutes": 90,
        "2+ Hours": 150,
        "3+ Hours": 210,
      };
      playTimeMinutes = timeMap[bggData.play_time] || null;
    }

    const catalogData: Record<string, unknown> = {
      bgg_id: bggId,
      title: bggData.title,
      image_url: bggData.image_url || null,
      description: bggData.description?.slice(0, 10000) || null,
      min_players: bggData.min_players || null,
      max_players: bggData.max_players || null,
      play_time_minutes: playTimeMinutes,
      weight,
      suggested_age: bggData.suggested_age || null,
      is_expansion: bggData.is_expansion === true,
      bgg_url: `https://boardgamegeek.com/boardgame/${bggId}`,
      bgg_community_rating: bggData.bgg_average_rating || null,
    };

    // Only include additional_images if provided and non-empty (avoid overwriting with empty array)
    if (bggData.additional_images && bggData.additional_images.length > 0) {
      catalogData.additional_images = bggData.additional_images;
    }

    const { data: catalogEntry, error: catalogError } = await supabaseAdmin
      .from("game_catalog")
      .upsert(catalogData, { onConflict: "bgg_id" })
      .select("id")
      .single();

    if (catalogError) {
      console.error(`[GameImport] Catalog upsert error for ${bggId}:`, catalogError.message);
      return;
    }

    // Link the library game to the catalog entry
    if (catalogEntry?.id) {
      await supabaseAdmin
        .from("games")
        .update({ catalog_id: catalogEntry.id })
        .eq("id", gameId);

      // Upsert catalog mechanics
      if (bggData.mechanics && bggData.mechanics.length > 0) {
        for (const mechanicName of bggData.mechanics) {
          const { data: mech } = await supabaseAdmin
            .from("mechanics")
            .select("id")
            .eq("name", mechanicName)
            .maybeSingle();
          if (mech) {
            await supabaseAdmin
              .from("catalog_mechanics")
              .upsert(
                { catalog_id: catalogEntry.id, mechanic_id: mech.id },
                { onConflict: "catalog_id,mechanic_id" }
              );
          }
        }
      }

      // Upsert catalog publisher
      if (bggData.publisher) {
        const { data: pub } = await supabaseAdmin
          .from("publishers")
          .select("id")
          .eq("name", bggData.publisher)
          .maybeSingle();
        if (pub) {
          await supabaseAdmin
            .from("catalog_publishers")
            .upsert(
              { catalog_id: catalogEntry.id, publisher_id: pub.id },
              { onConflict: "catalog_id,publisher_id" }
            );
        }
      }

      // Upsert catalog designers
      if (bggData.designers && bggData.designers.length > 0) {
        for (const designerName of bggData.designers) {
          const { data: existing } = await supabaseAdmin
            .from("designers")
            .select("id")
            .eq("name", designerName)
            .maybeSingle();
          const designerId = existing?.id || (await supabaseAdmin
            .from("designers")
            .upsert({ name: designerName }, { onConflict: "name" })
            .select("id")
            .single()).data?.id;
          if (designerId) {
            await supabaseAdmin
              .from("catalog_designers")
              .upsert(
                { catalog_id: catalogEntry.id, designer_id: designerId },
                { onConflict: "catalog_id,designer_id" }
              );
          }
        }
      }

      // Upsert catalog artists
      if (bggData.artists && bggData.artists.length > 0) {
        for (const artistName of bggData.artists) {
          const { data: existing } = await supabaseAdmin
            .from("artists")
            .select("id")
            .eq("name", artistName)
            .maybeSingle();
          const artistId = existing?.id || (await supabaseAdmin
            .from("artists")
            .upsert({ name: artistName }, { onConflict: "name" })
            .select("id")
            .single()).data?.id;
          if (artistId) {
            await supabaseAdmin
              .from("catalog_artists")
              .upsert(
                { catalog_id: catalogEntry.id, artist_id: artistId },
                { onConflict: "catalog_id,artist_id" }
              );
          }
        }
      }

      console.log(`[GameImport] Catalog entry upserted for "${bggData.title}" (${bggId}), linked to game ${gameId}`);
    }
  } catch (e) {
    console.error(`[GameImport] Catalog upsert failed for ${bggId}:`, e);
  }
}

const normalizeSaleCondition = (saleCondition: string | undefined): string | undefined => {
  if (!saleCondition) return undefined;
  const c = saleCondition.trim();
  // Legacy self-hosted used "New" instead of "New/Sealed"
  if (c === "New") return "New/Sealed";
  return c;
};

// ---------------------------------------------------------------------------
// AI Description Enrichment Helper
// Takes raw BGG data and produces the formatted "Quick Gameplay Overview" style
// ---------------------------------------------------------------------------
async function enrichDescriptionWithAI(
  title: string,
  rawDescription: string,
  bggData: {
    min_players?: number;
    max_players?: number;
    mechanics?: string[];
    is_expansion?: boolean;
    difficulty?: string;
    play_time?: string;
  }
): Promise<string> {
  if (!isAIConfigured()) {
    return rawDescription;
  }

  try {
    console.log(`[GameImport] Enriching description for "${title}" with AI (${getAIProviderName()})`);
    
    const mechanicsStr = bggData.mechanics?.join(", ") || "unknown";
    const playerStr = bggData.min_players && bggData.max_players
      ? `${bggData.min_players}-${bggData.max_players} players`
      : "unknown player count";
    const isExpansion = bggData.is_expansion === true;

    const aiResult = await aiComplete({
      messages: [
        {
          role: "system",
          content: `You are a board game description writer. Given raw game data, create a polished, engaging description in this EXACT format:

A brief engaging overview paragraph about the game (2-3 sentences).

## Quick Gameplay Overview

- **Goal:** One sentence about what players are trying to achieve.
- **On Your Turn:** Brief description of main actions players can take.
- **End Game:** One sentence about when/how the game ends.
- **Winner:** One sentence about victory condition.

A brief closing sentence about what makes the game appealing.

RULES:
- Use markdown with ## headers, **bold**, and bullet points
- Keep it CONCISE: 150-200 words maximum
- If it's an expansion, mention what base game it requires
- Do NOT invent gameplay mechanics that aren't mentioned in the source data
- If the source description is very short or vague, use the mechanics list and player count to infer reasonable gameplay overview
- RESPOND WITH THE DESCRIPTION TEXT ONLY, no JSON wrapping`,
        },
        {
          role: "user",
          content: `Create a formatted description for this board game:

Title: ${title}
Type: ${isExpansion ? "Expansion" : "Standalone Game"}
Raw Description: ${rawDescription.slice(0, 3000)}
Mechanics: ${mechanicsStr}
Players: ${playerStr}
Difficulty: ${bggData.difficulty || "unknown"}
Play Time: ${bggData.play_time || "unknown"}`,
        },
      ],
    });

    if (aiResult.success && aiResult.content) {
      // Clean any JSON wrapping if present
      let enriched = aiResult.content.trim();
      // Remove markdown code fences if AI wrapped it
      enriched = enriched.replace(/^```(?:markdown)?\s*/i, "").replace(/\s*```$/i, "").trim();
      if (enriched.length > 50) {
        console.log(`[GameImport] AI enrichment successful (${enriched.length} chars)`);
        return enriched;
      }
    }
    
    console.warn("[GameImport] AI enrichment returned empty/short result, using raw description");
    return rawDescription;
  } catch (e) {
    console.error("[GameImport] AI enrichment error:", e);
    return rawDescription;
  }
}

// ---------------------------------------------------------------------------
// pickBestGeekdoImage - extract high-quality box art from HTML, avoiding social crops
// ---------------------------------------------------------------------------
function pickBestGeekdoImage(html: string): string | null {
  const imageRegex = /https?:\/\/cf\.geekdo-images\.com[^\s"'<>]+/g;
  const all = html.match(imageRegex) || [];
  const unique = [...new Set(all)];

  const filtered = unique.filter((img) =>
    !/crop100|square30|100x100|150x150|_thumb|_avatar|_micro|opengraph|__opengraph|1200x630/i.test(img)
  );

  filtered.sort((a, b) => {
    const prio = (url: string) => {
      if (/_itemrep/i.test(url)) return 0;
      if (/_imagepage/i.test(url)) return 1;
      if (/_original/i.test(url)) return 2;
      return 3;
    };
    return prio(a) - prio(b);
  });

  return filtered[0] ?? null;
}

// ---------------------------------------------------------------------------
// findExistingGame - check for duplicate by bgg_url, bgg_id, or slug
// ---------------------------------------------------------------------------
async function findExistingGame(
  supabaseAdmin: ReturnType<typeof createClient>,
  gameData: { bgg_url?: string | null; bgg_id?: string | null; title?: string },
  libraryId: string
): Promise<string | null> {
  // 1. Check by BGG URL
  if (gameData.bgg_url) {
    const { data } = await supabaseAdmin
      .from("games").select("id")
      .eq("bgg_url", gameData.bgg_url)
      .eq("library_id", libraryId)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  // 2. Check by BGG ID
  if (gameData.bgg_id) {
    const { data } = await supabaseAdmin
      .from("games").select("id")
      .eq("bgg_id", gameData.bgg_id)
      .eq("library_id", libraryId)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  // 3. Check by slug to prevent unique constraint violations
  if (gameData.title) {
    const decodedTitle = decodeHtmlEntities(gameData.title);
    const slug = decodedTitle.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (slug) {
      const { data } = await supabaseAdmin
        .from("games").select("id")
        .eq("slug", slug)
        .eq("library_id", libraryId)
        .maybeSingle();
      if (data?.id) return data.id;
    }
  }
  return null;
}

// Export handler for self-hosted router
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's auth token to verify identity
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the user token (use getUser() for compatibility with self-hosted)
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) {
      console.error("[GameImport] Auth error:", userError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;

    // Create admin client with service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if user is either a global admin OR owns a library
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    // Use .limit(1) instead of .maybeSingle() to avoid errors when user owns multiple libraries
    const { data: libraryRows } = await supabaseAdmin
      .from("libraries")
      .select("id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);

    const libraryData = libraryRows?.[0] || null;

    // Allow access if user is admin OR owns a library
    if (!roleData && !libraryData) {
      return new Response(
        JSON.stringify({ success: false, error: "You must own a library to import games" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { url, library_id, is_coming_soon, is_for_sale, sale_price, sale_condition, is_expansion, parent_game_id, location_room, location_shelf, location_misc, purchase_price, purchase_date, sleeved, upgraded_components, crowdfunded, inserts } = await req.json();

    // Determine which library to add the game to
    // If library_id is provided, use it; otherwise use the user's own library
    let targetLibraryId = library_id;
    if (!targetLibraryId && libraryData) {
      targetLibraryId = libraryData.id;
    }
    
    if (!targetLibraryId) {
      return new Response(
        JSON.stringify({ success: false, error: "No library specified and user has no library" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate input URL
    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate URL format
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("Invalid protocol");
      }
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid URL format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detect collection/user URLs — these need the bulk import flow, not single game import
    const collectionMatch = url.match(/boardgamegeek\.com\/(?:collection\/user|user)\/([^\/\?#]+)/i);
    if (collectionMatch) {
      const username = decodeURIComponent(collectionMatch[1]);
      return new Response(
        JSON.stringify({
          success: false,
          error: `"${username}" looks like a BGG profile or collection URL. To import a full collection, use the "BGG Collection" import tab and enter the username "${username}" instead.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Importing game from URL:", url);

    // Extract BGG ID for validation and primary data source
    const bggIdMatch = url.match(/boardgame(?:expansion)?\/(\d+)/);
    const bggId = bggIdMatch?.[1];

    // ---------------------------------------------------------------------------
    // STEP 0: Check catalog first for pre-existing enriched data
    // ---------------------------------------------------------------------------
    let catalogData: any = null;
    if (bggId) {
      const { data: existingCatalog } = await supabaseAdmin
        .from("game_catalog")
        .select("id, title, description, image_url, min_players, max_players, play_time_minutes, weight, suggested_age, is_expansion, bgg_community_rating")
        .eq("bgg_id", bggId)
        .maybeSingle();

      if (existingCatalog?.description && existingCatalog.description.includes("Quick Gameplay Overview")) {
        catalogData = existingCatalog;
        console.log(`[GameImport] Found enriched catalog entry for BGG ${bggId}: "${existingCatalog.title}"`);
      }
    }

    // ---------------------------------------------------------------------------
    // STEP 1: Try BGG XML API first (fast, ~0.5s, reliable descriptions)
    // ---------------------------------------------------------------------------
    let bggData: {
      bgg_id: string;
      title?: string;
      image_url?: string;
      description?: string;
      min_players?: number;
      max_players?: number;
      suggested_age?: string;
      play_time?: string;
      difficulty?: string;
      mechanics?: string[];
      publisher?: string;
      designers?: string[];
      artists?: string[];
      is_expansion?: boolean;
      bgg_average_rating?: number;
    } | null = null;

    if (bggId) {
      console.log("Fetching data from BGG XML API for:", bggId);
      bggData = await fetchBGGDataFromXML(bggId);
      
      // If we have a catalog entry with enriched description, use that instead
      if (catalogData && bggData) {
        console.log(`[GameImport] Using catalog description for "${catalogData.title}" instead of raw BGG`);
        bggData.description = catalogData.description;
        // Also fill in any missing fields from catalog
        if (!bggData.image_url && catalogData.image_url) bggData.image_url = catalogData.image_url;
        if (!bggData.min_players && catalogData.min_players) bggData.min_players = catalogData.min_players;
        if (!bggData.max_players && catalogData.max_players) bggData.max_players = catalogData.max_players;
        if (!bggData.suggested_age && catalogData.suggested_age) bggData.suggested_age = catalogData.suggested_age;
      }

      if (bggData.title && bggData.description) {
        console.log(`BGG data ready for ${bggData.title} (${bggData.description.length} chars)`);
      } else if (bggData.title) {
        console.log(`BGG XML API returned title-only data for ${bggId}, generating description`);
        bggData.description = `${bggData.title} - a board game${bggData.is_expansion ? ' expansion' : ''} imported from BoardGameGeek.`;
      } else {
        console.log(`BGG XML API returned no title for ${bggId}`);
      }
    }

    // ---------------------------------------------------------------------------
    // STEP 2: If BGG XML API provided sufficient data, use it directly (FAST PATH)
    // ---------------------------------------------------------------------------
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const hasCompleteData = bggData?.title;

    if (hasCompleteData && bggData) {
      // Skip AI enrichment if catalog already has formatted description
      const skipAIEnrichment = catalogData && bggData.description?.includes("Quick Gameplay Overview");
      console.log(`Using BGG data (fast path)${skipAIEnrichment ? ' with catalog description' : ' + AI enrichment'}`);

      // Enrich description with AI only if catalog doesn't have it
      if (bggData.description && !skipAIEnrichment) {
        bggData.description = await enrichDescriptionWithAI(
          bggData.title!,
          bggData.description,
          {
            min_players: bggData.min_players,
            max_players: bggData.max_players,
            mechanics: bggData.mechanics,
            is_expansion: bggData.is_expansion,
            difficulty: bggData.difficulty,
            play_time: bggData.play_time,
          }
        );
      }

      // We have everything we need from the XML API
      // Skip Firecrawl and AI entirely for maximum speed
      
      // Handle mechanics
      let mechanicIds: string[] = [];
      if (bggData.mechanics && bggData.mechanics.length > 0) {
        for (const mechanicName of bggData.mechanics) {
          const { data: existingMechanic } = await supabaseAdmin
            .from("mechanics")
            .select("id")
            .eq("name", mechanicName)
            .maybeSingle();

          if (existingMechanic) {
            mechanicIds.push(existingMechanic.id);
          } else {
            const { data: newMechanic, error: mechError } = await supabaseAdmin
              .from("mechanics")
              .insert({ name: mechanicName })
              .select("id")
              .single();
            
            if (newMechanic && !mechError) {
              mechanicIds.push(newMechanic.id);
            }
          }
        }
      }

      // Handle publisher
      let publisherId: string | null = null;
      if (bggData.publisher) {
        const { data: existingPublisher } = await supabaseAdmin
          .from("publishers")
          .select("id")
          .eq("name", bggData.publisher)
          .maybeSingle();

        if (existingPublisher) {
          publisherId = existingPublisher.id;
        } else {
          const { data: newPublisher, error: pubError } = await supabaseAdmin
            .from("publishers")
            .insert({ name: bggData.publisher })
            .select("id")
            .single();
          
          if (newPublisher && !pubError) {
            publisherId = newPublisher.id;
          }
        }
      }

      // Handle expansion detection - try to find parent game
      let detectedParentGameId: string | null = null;
      const aiDetectedExpansion = bggData.is_expansion === true;
      
      if (aiDetectedExpansion && bggData.title) {
        const baseTitle = bggData.title.split(':')[0].trim();
        if (baseTitle && baseTitle !== bggData.title) {
          const { data: exactMatch } = await supabaseAdmin
            .from("games")
            .select("id, title")
            .eq("library_id", targetLibraryId)
            .eq("is_expansion", false)
            .ilike("title", baseTitle)
            .maybeSingle();

          if (exactMatch) {
            detectedParentGameId = exactMatch.id;
            console.log("Found parent game match:", exactMatch.title);
          }
        }
      }

      // Fetch gallery images from BGG JSON API (non-blocking, best-effort)
      const galleryImages = bggId ? await fetchBggGalleryImages(bggId, bggData.image_url) : [];

      // Build game data
      const normalizedSaleCondition = normalizeSaleCondition(sale_condition);
      const gameData = {
        title: bggData.title!.slice(0, 500),
        description: bggData.description!.slice(0, 10000),
        image_url: bggData.image_url,
        additional_images: galleryImages,
        difficulty: bggData.difficulty || "3 - Medium",
        game_type: "Board Game",
        play_time: bggData.play_time || "45-60 Minutes",
        min_players: bggData.min_players || 1,
        max_players: bggData.max_players || 4,
        suggested_age: bggData.suggested_age || "10+",
        publisher_id: publisherId,
        bgg_id: bggId,
        bgg_url: url.includes("boardgamegeek.com") ? url : null,
        is_coming_soon: is_coming_soon === true,
        is_for_sale: is_for_sale === true,
        sale_price: is_for_sale === true && sale_price ? Number(sale_price) : null,
        sale_condition: is_for_sale === true ? normalizedSaleCondition : null,
        is_expansion: is_expansion === true || aiDetectedExpansion === true,
        parent_game_id: is_expansion === true ? parent_game_id : (aiDetectedExpansion ? detectedParentGameId : null),
        location_room: location_room || null,
        location_shelf: location_shelf || null,
        location_misc: location_misc || null,
        sleeved: sleeved === true,
        upgraded_components: upgraded_components === true,
        crowdfunded: crowdfunded === true,
        inserts: inserts === true,
        library_id: targetLibraryId,
      };

      // Upsert: check by bgg_url, bgg_id, or slug to avoid duplicates
      const existingId = await findExistingGame(supabaseAdmin, gameData, targetLibraryId);

      const write = existingId
        ? supabaseAdmin.from("games").update(gameData).eq("id", existingId).select().single()
        : supabaseAdmin.from("games").insert(gameData).select().single();

      const { data: game, error: gameError } = await write;

      if (gameError) {
        console.error("Game insert error:", gameError);
        throw gameError;
      }

      // Handle admin data
      const adminData = {
        game_id: game.id,
        purchase_price: purchase_price ? Number(purchase_price) : null,
        purchase_date: purchase_date || null,
      };
      await supabaseAdmin.from("game_admin_data").upsert(adminData, { onConflict: "game_id" });

      // Link mechanics
      if (mechanicIds.length > 0) {
        const mechanicLinks = mechanicIds.map((mechanicId) => ({
          game_id: game.id,
          mechanic_id: mechanicId,
        }));
        await supabaseAdmin.from("game_mechanics").insert(mechanicLinks);
      }

      // Link designers
      if (bggData.designers && bggData.designers.length > 0) {
        for (const designerName of bggData.designers) {
          const { data: existing } = await supabaseAdmin
            .from("designers")
            .select("id")
            .eq("name", designerName)
            .maybeSingle();
          const designerId = existing?.id || (await supabaseAdmin
            .from("designers")
            .upsert({ name: designerName }, { onConflict: "name" })
            .select("id")
            .single()).data?.id;
          if (designerId) {
            await supabaseAdmin
              .from("game_designers")
              .upsert({ game_id: game.id, designer_id: designerId }, { onConflict: "game_id,designer_id" });
          }
        }
      }

      // Link artists
      if (bggData.artists && bggData.artists.length > 0) {
        for (const artistName of bggData.artists) {
          const { data: existing } = await supabaseAdmin
            .from("artists")
            .select("id")
            .eq("name", artistName)
            .maybeSingle();
          const artistId = existing?.id || (await supabaseAdmin
            .from("artists")
            .upsert({ name: artistName }, { onConflict: "name" })
            .select("id")
            .single()).data?.id;
          if (artistId) {
            await supabaseAdmin
              .from("game_artists")
              .upsert({ game_id: game.id, artist_id: artistId }, { onConflict: "game_id,artist_id" });
          }
        }
      }
      // NOTE: BGG community ratings are no longer saved into library game_ratings.
      // Library ratings come from user personal BGG ratings (during collection import)
      // and visitor ratings. BGG community average is stored only on game_catalog.bgg_community_rating.

      // Upsert into canonical game catalog
      if (bggId) {
        await upsertCatalogEntry(supabaseAdmin, bggId, bggData as any, game.id);
      }

      console.log("Game imported successfully (fast path):", game.title);

      // Send Discord notification for NEW games only
      // Skip HTTP-based notification in self-hosted mode to prevent single-threaded deadlock
      if (!existingId && !IS_SELF_HOSTED) {
        try {
          const playerCount = game.min_players && game.max_players
            ? `${game.min_players}-${game.max_players} players`
            : game.min_players
              ? `${game.min_players}+ players`
              : undefined;

          const discordPayload = {
            library_id: targetLibraryId,
            event_type: "game_added",
            data: {
              title: game.title,
              image_url: game.image_url,
              player_count: playerCount,
              play_time: game.play_time,
            },
          };

          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          
          console.log("Sending Discord notification for:", game.title);
          const notifyResponse = await fetch(`${supabaseUrl}/functions/v1/discord-notify`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(discordPayload),
          });
          
          if (notifyResponse.ok) {
            console.log("Discord notification sent successfully");
          } else {
            console.error("Discord notification failed:", await notifyResponse.text());
          }
        } catch (discordErr) {
          console.error("Discord notification error:", discordErr);
        }
      } else if (!existingId) {
        console.log("Self-hosted: skipping Discord HTTP notification to prevent deadlock");
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          action: existingId ? "updated" : "created",
          game: {
            ...game,
            mechanics: bggData.mechanics || [],
            publisher: bggData.publisher || null,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------------------------------------------------------------------------
    // STEP 3: For BGG URLs, try direct HTML scraping BEFORE Firecrawl
    // ---------------------------------------------------------------------------
    if (bggId) {
      console.log(`[GameImport] BGG XML failed, trying direct HTML scrape for ${bggId}`);
      try {
        const directRes = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
        });
        if (directRes.ok) {
          const html = await directRes.text();
          const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
                               html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/i);
          const titleTagMatch = html.match(/<title>([^<]+)<\/title>/i);
          const scrapedTitle = ogTitleMatch?.[1] || titleTagMatch?.[1]?.replace(/\s*\|.*$/, '').replace(/\s*\u2014.*$/, '').trim();
          
          // Use pickBestGeekdoImage for high-quality box art, fall back to og:image
          const bestImage = pickBestGeekdoImage(html);
          const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                               html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
          const scrapedImage = bestImage || ogImageMatch?.[1] || null;
          
          const ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i) ||
                              html.match(/<meta\s+content="([^"]+)"\s+property="og:description"/i);
          const scrapedDesc = ogDescMatch?.[1] || null;

          const isExpansionFromHtml = url.includes('/boardgameexpansion/') || 
                                      is_expansion === true;

          if (scrapedTitle) {
            console.log(`[GameImport] Direct HTML scrape success: ${scrapedTitle}`);
            
            // Enrich description with AI
            const rawDesc = scrapedDesc || `${scrapedTitle} - a board game${isExpansionFromHtml ? ' expansion' : ''} imported from BoardGameGeek.`;
            const enrichedDesc = await enrichDescriptionWithAI(scrapedTitle, rawDesc, {
              is_expansion: isExpansionFromHtml,
            });
            
            const normalizedSaleCondition = normalizeSaleCondition(sale_condition);
            const scrapedGameData = {
              title: scrapedTitle.slice(0, 500),
              description: enrichedDesc.slice(0, 10000),
              image_url: scrapedImage,
              additional_images: [] as string[],
              difficulty: "3 - Medium",
              game_type: "Board Game" as const,
              play_time: "45-60 Minutes",
              min_players: 1,
              max_players: 4,
              suggested_age: "10+",
              bgg_id: bggId,
              bgg_url: url,
              library_id: targetLibraryId,
              is_expansion: isExpansionFromHtml,
              parent_game_id: parent_game_id || null,
              is_coming_soon: is_coming_soon === true,
              is_for_sale: is_for_sale === true,
              sale_price: is_for_sale ? sale_price || null : null,
              sale_condition: is_for_sale ? normalizedSaleCondition || null : null,
              location_room: location_room || null,
              location_shelf: location_shelf || null,
              location_misc: location_misc || null,
              sleeved: sleeved === true,
              upgraded_components: upgraded_components === true,
              crowdfunded: crowdfunded === true,
              inserts: inserts === true,
            };

            const { data: game, error: insertError } = await supabaseAdmin
              .from("games")
              .insert(scrapedGameData)
              .select()
              .single();

            if (insertError || !game) {
              console.error("Insert error (direct scrape):", insertError?.message);
              return new Response(
                JSON.stringify({ success: false, error: insertError?.message || "Failed to save game" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }

            if (purchase_price || purchase_date) {
              await supabaseAdmin.from("game_admin_data").insert({
                game_id: game.id,
                purchase_price: purchase_price ? parseFloat(purchase_price) : null,
                purchase_date: purchase_date || null,
              });
            }

            return new Response(
              JSON.stringify({ success: true, action: "created", game: { ...game, mechanics: [], publisher: null } }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          } else {
            console.warn("[GameImport] Direct HTML scrape got no title from page");
          }
        } else {
          await directRes.text().catch(() => {});
          console.warn(`[GameImport] Direct HTML scrape returned ${directRes.status}`);
        }
      } catch (scrapeErr) {
        console.error("[GameImport] Direct HTML scrape error:", scrapeErr);
      }
    }

    // ---------------------------------------------------------------------------
    // STEP 4: Fallback to Firecrawl for non-BGG URLs or when direct scrape failed
    // ---------------------------------------------------------------------------
    console.log("Falling back to Firecrawl + AI");
    
    if (!firecrawlKey) {
      if (bggData?.title) {
        console.error("Firecrawl API key not configured, using partial BGG data");
      } else {
        console.error("No data sources available (BGG XML, direct scrape, and Firecrawl all failed)");
        return new Response(
          JSON.stringify({ success: false, error: "Could not import this game. BGG may be temporarily blocking requests from this server. Please try again later or add the game manually." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log("Scraping with Firecrawl...");
    
    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "rawHtml"],
        onlyMainContent: true,
      }),
    });

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      console.error("Firecrawl error:", scrapeResponse.status, errorText);
      
      // If we have partial BGG data, use it instead of failing entirely
      if (bggData?.title) {
        console.log("Firecrawl failed but BGG XML provided partial data, using that instead");
        // Build game with partial BGG data (same logic as fast path but with defaults)
        const normalizedSaleCondition = normalizeSaleCondition(sale_condition);
        const partialGameData = {
          title: bggData.title.slice(0, 500),
          description: bggData.description?.slice(0, 10000) || `${bggData.title} - imported from BoardGameGeek`,
          image_url: bggData.image_url || null,
          additional_images: [],
          difficulty: bggData.difficulty || "3 - Medium",
          game_type: "Board Game" as const,
          play_time: bggData.play_time || "45-60 Minutes",
          min_players: bggData.min_players || 1,
          max_players: bggData.max_players || 4,
          suggested_age: bggData.suggested_age || "10+",
          bgg_id: bggData.bgg_id,
          bgg_url: url,
          library_id: targetLibraryId,
          is_expansion: is_expansion === true || bggData.is_expansion === true,
          parent_game_id: parent_game_id || null,
          is_coming_soon: is_coming_soon === true,
          is_for_sale: is_for_sale === true,
          sale_price: is_for_sale ? sale_price || null : null,
          sale_condition: is_for_sale ? normalizedSaleCondition || null : null,
          location_room: location_room || null,
          location_shelf: location_shelf || null,
          location_misc: location_misc || null,
          sleeved: sleeved === true,
          upgraded_components: upgraded_components === true,
          crowdfunded: crowdfunded === true,
          inserts: inserts === true,
        };

        const partialExistingId = await findExistingGame(supabaseAdmin, partialGameData, targetLibraryId);
        const partialWrite = partialExistingId
          ? supabaseAdmin.from("games").update(partialGameData).eq("id", partialExistingId).select().single()
          : supabaseAdmin.from("games").insert(partialGameData).select().single();
        const { data: game, error: insertError } = await partialWrite;

        if (insertError || !game) {
          console.error("Insert error (partial):", insertError?.message, insertError?.code, insertError?.details, insertError?.hint);
          return new Response(
            JSON.stringify({ success: false, error: insertError?.message || "Failed to save game" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Handle mechanics from BGG data
        if (bggData.mechanics && bggData.mechanics.length > 0) {
          for (const mechanicName of bggData.mechanics) {
            const { data: existingMechanic } = await supabaseAdmin
              .from("mechanics").select("id").eq("name", mechanicName).maybeSingle();
            const mechId = existingMechanic?.id;
            if (mechId) {
              await supabaseAdmin.from("game_mechanics").insert({ game_id: game.id, mechanic_id: mechId });
            } else {
              const { data: newMech } = await supabaseAdmin.from("mechanics").insert({ name: mechanicName }).select("id").single();
              if (newMech) await supabaseAdmin.from("game_mechanics").insert({ game_id: game.id, mechanic_id: newMech.id });
            }
          }
        }

        // Handle purchase data
        if (purchase_price || purchase_date) {
          await supabaseAdmin.from("game_admin_data").insert({
            game_id: game.id,
            purchase_price: purchase_price ? parseFloat(purchase_price) : null,
            purchase_date: purchase_date || null,
          });
        }

        return new Response(
          JSON.stringify({ success: true, action: partialExistingId ? "updated" : "created", game: { ...game, mechanics: bggData.mechanics || [], publisher: bggData.publisher || null } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Last resort: if this is a BGG URL, try direct HTML scraping
      if (bggId) {
        console.log(`[GameImport] Attempting direct BGG HTML scrape for ${bggId}`);
        try {
          const directRes = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml",
              "Accept-Language": "en-US,en;q=0.9",
            },
          });
          if (directRes.ok) {
            const html = await directRes.text();
            const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
                                 html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/i);
            const titleTagMatch = html.match(/<title>([^<]+)<\/title>/i);
            const scrapedTitle = ogTitleMatch?.[1] || titleTagMatch?.[1]?.replace(/\s*\|.*$/, '').replace(/\s*\u2014.*$/, '').trim();
            
            // Use pickBestGeekdoImage for high-quality box art, fall back to og:image
            const bestImage = pickBestGeekdoImage(html);
            const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                                 html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
            const scrapedImage = bestImage || ogImageMatch?.[1] || null;
            
            const ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i) ||
                                html.match(/<meta\s+content="([^"]+)"\s+property="og:description"/i);
            const scrapedDesc = ogDescMatch?.[1] || null;

            const isExpansionFromHtml = url.includes('/boardgameexpansion/') || 
                                        is_expansion === true;

            if (scrapedTitle) {
              console.log(`[GameImport] Direct scrape got title: ${scrapedTitle}`);
              
              // Enrich description with AI
              const rawDesc = scrapedDesc || `${scrapedTitle} - a board game${isExpansionFromHtml ? ' expansion' : ''} imported from BoardGameGeek.`;
              const enrichedDesc = await enrichDescriptionWithAI(scrapedTitle, rawDesc, {
                is_expansion: isExpansionFromHtml,
              });
              
              const normalizedSaleCondition = normalizeSaleCondition(sale_condition);
              const scrapedGameData = {
                title: scrapedTitle.slice(0, 500),
                description: enrichedDesc.slice(0, 10000),
                image_url: scrapedImage,
                additional_images: [] as string[],
                difficulty: "3 - Medium",
                game_type: "Board Game" as const,
                play_time: "45-60 Minutes",
                min_players: 1,
                max_players: 4,
                suggested_age: "10+",
                bgg_id: bggId,
                bgg_url: url,
                library_id: targetLibraryId,
                is_expansion: isExpansionFromHtml,
                parent_game_id: parent_game_id || null,
                is_coming_soon: is_coming_soon === true,
                is_for_sale: is_for_sale === true,
                sale_price: is_for_sale ? sale_price || null : null,
                sale_condition: is_for_sale ? normalizedSaleCondition || null : null,
                location_room: location_room || null,
                location_shelf: location_shelf || null,
                location_misc: location_misc || null,
                sleeved: sleeved === true,
                upgraded_components: upgraded_components === true,
                crowdfunded: crowdfunded === true,
                inserts: inserts === true,
              };

              const scrapeExistingId = await findExistingGame(supabaseAdmin, scrapedGameData, targetLibraryId);
              const scrapeWrite = scrapeExistingId
                ? supabaseAdmin.from("games").update(scrapedGameData).eq("id", scrapeExistingId).select().single()
                : supabaseAdmin.from("games").insert(scrapedGameData).select().single();
              const { data: game, error: insertError } = await scrapeWrite;

              if (insertError || !game) {
                console.error("Insert error (direct scrape):", insertError?.message);
                return new Response(
                  JSON.stringify({ success: false, error: insertError?.message || "Failed to save game" }),
                  { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }

              if (purchase_price || purchase_date) {
                await supabaseAdmin.from("game_admin_data").insert({
                  game_id: game.id,
                  purchase_price: purchase_price ? parseFloat(purchase_price) : null,
                  purchase_date: purchase_date || null,
                });
              }

              return new Response(
                JSON.stringify({ success: true, action: scrapeExistingId ? "updated" : "created", game: { ...game, mechanics: [], publisher: null } }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          } else {
            await directRes.text().catch(() => {});
          }
        } catch (scrapeErr) {
          console.error("[GameImport] Direct BGG scrape failed:", scrapeErr);
        }
      }

      return new Response(
        JSON.stringify({ success: false, error: `Failed to scrape page: ${scrapeResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const scrapeData = await scrapeResponse.json();
    const markdown = scrapeData.data?.markdown || scrapeData.markdown;
    const rawHtml = scrapeData.data?.rawHtml || scrapeData.rawHtml || "";

    // Extract image URLs from the raw HTML (BGG uses cf.geekdo-images.com)
    // Only from main page - no gallery scraping to avoid irrelevant images
    const imageRegex = /https?:\/\/cf\.geekdo-images\.com[^\s"'<>]+/g;
    const allImageMatches = rawHtml.match(imageRegex) || [];
    
    // Deduplicate images
    const uniqueImages = [...new Set(allImageMatches)] as string[];
    
    // Filter out tiny thumbnails but allow various quality levels
    const filteredImages = uniqueImages.filter((img) => {
      // Exclude tiny thumbnails and avatars
      const isTiny = /crop100|square30|100x100|150x150|_thumb|_avatar|_micro/i.test(img);
      return !isTiny;
    });
    
    // Prioritize box art (_itemrep) first, then large images (_imagepage), then others
    const sortedImageLinks = filteredImages.sort((a, b) => {
      const getPriority = (url: string) => {
        if (/_itemrep/i.test(url)) return 0; // Box art - highest priority
        if (/_imagepage/i.test(url)) return 1; // Full-size photos
        if (/_original/i.test(url)) return 2; // Original uploads
        if (/\/pic\d+/i.test(url)) return 3; // Standard BGG image format
        return 4; // Other images
      };
      return getPriority(a) - getPriority(b);
    });
    
    // Take the first image as main (box art preferred), then additional images
    // Use BGG XML image if available, otherwise use scraped image
    const mainImage = bggData?.image_url || sortedImageLinks[0] || null;
    // Get up to 5 additional images (excluding the main one)
    const additionalScrapedImages = sortedImageLinks.slice(1, 6);

    if (!markdown) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not extract content from the page" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Scraped content length:", markdown.length);

    // Step 2: Use AI to extract structured game data
    if (!isAIConfigured()) {
      console.error("No AI provider configured (set PERPLEXITY_API_KEY or LOVABLE_API_KEY)");
      return new Response(
        JSON.stringify({ success: false, error: "AI service not configured. Set PERPLEXITY_API_KEY in your environment." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Extracting game data with AI using:", getAIProviderName());
    
    const aiResult = await aiComplete({
      messages: [
        {
          role: "system",
          content: `You are a board game data extraction expert. Extract detailed, structured game information from the provided content.

IMPORTANT RULES:

1. For enum fields, you MUST use these EXACT values:
   - difficulty: ${DIFFICULTY_LEVELS.map(d => `"${d}"`).join(", ")}
   - play_time: ${PLAY_TIME_OPTIONS.map(p => `"${p}"`).join(", ")}
   - game_type: ${GAME_TYPE_OPTIONS.map(t => `"${t}"`).join(", ")}

2. For the DESCRIPTION field, create a CONCISE description that includes:
   - An engaging overview paragraph about the game (2-3 sentences max)
   - A "## Quick Gameplay Overview" section with BULLET POINTS:
     - **Goal:** One sentence about what players are trying to achieve
     - **Each Round:** or **On Your Turn:** Use bullet points with bold labels for key actions (keep each to one line)
     - **Final Round:** or **End Game:** One sentence about how the game ends
     - **Winner:** One sentence about victory condition
   - A brief closing sentence about what makes the game special (optional)
   
   Use markdown formatting with headers (##), bold (**text**), and bullet points.
   Keep it CONCISE - aim for 150-200 words maximum. Players should be able to scan and understand quickly.

3. For IMAGES:
   - For main_image: Use the FIRST image with "_itemrep" (box art) - this is the primary image
   - For gameplay_images: Include up to 3 high-quality component/gameplay photos (not duplicates of box art)

4. For mechanics, extract actual game mechanics (e.g., "Worker Placement", "Set Collection", "Dice Rolling").

5. For publisher, extract the publisher company name.

6. EXPANSION DETECTION - CRITICAL:
   - Look for indicators that this is an EXPANSION (not a standalone game):
     - The title contains words like "Expansion", "Promo", "Pack", "Mini Expansion", "Scenario", "Module"
     - The page explicitly says "Expansion for [Base Game Name]" or "Requires [Base Game Name]"
     - BoardGameGeek categorizes it as an expansion
   - If it's an expansion, set is_expansion to true
   - Extract the BASE GAME TITLE (exactly as it appears) into base_game_title field
   - Example: "Wingspan: European Expansion" → is_expansion: true, base_game_title: "Wingspan"

RESPOND WITH VALID JSON ONLY. Example format:
{
  "title": "Game Name",
  "description": "Description text...",
  "difficulty": "3 - Medium",
  "play_time": "45-60 Minutes",
  "game_type": "Board Game",
  "min_players": 2,
  "max_players": 4,
  "suggested_age": "10+",
  "mechanics": ["Worker Placement", "Set Collection"],
  "publisher": "Publisher Name",
  "main_image": "https://...",
  "gameplay_images": ["https://..."],
  "bgg_url": "https://boardgamegeek.com/...",
  "is_expansion": false,
  "base_game_title": null
}`,
        },
        {
          role: "user",
          content: `Extract comprehensive board game data from this page content.

TARGET PAGE (must match): ${url}

AVAILABLE IMAGES (use first _itemrep for main_image, others for gameplay_images):
Main: ${mainImage || "No main image found"}
Additional: ${additionalScrapedImages.slice(0, 3).join(", ") || "None"}

Page content:
${markdown.slice(0, 18000)}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_game_data",
            description: "Extract structured game data from page content",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "The game title" },
                description: { 
                  type: "string", 
                  description: "Concise game description with markdown formatting. Include brief overview, Quick Gameplay Overview section with bullet points for Goal/Actions/End Game/Winner. Keep to 150-200 words max." 
                },
                difficulty: { 
                  type: "string", 
                  enum: DIFFICULTY_LEVELS,
                  description: "Difficulty level" 
                },
                play_time: { 
                  type: "string", 
                  enum: PLAY_TIME_OPTIONS,
                  description: "Play time category" 
                },
                game_type: { 
                  type: "string", 
                  enum: GAME_TYPE_OPTIONS,
                  description: "Type of game" 
                },
                min_players: { type: "number", description: "Minimum player count" },
                max_players: { type: "number", description: "Maximum player count" },
                suggested_age: { type: "string", description: "Suggested age (e.g., '10+')" },
                mechanics: { 
                  type: "array", 
                  items: { type: "string" },
                  description: "Game mechanics like Worker Placement, Set Collection, etc." 
                },
                publisher: { type: "string", description: "Publisher name" },
                main_image: { type: "string", description: "Primary box art/cover image URL - the main, high-quality game image" },
                gameplay_images: { 
                  type: "array", 
                  items: { type: "string" },
                  description: "1-2 gameplay/component images only. No thumbnails, no duplicates of main image." 
                },
                bgg_url: { type: "string", description: "BoardGameGeek URL if available" },
                is_expansion: { type: "boolean", description: "True if this is an expansion/promo/pack that requires a base game" },
                base_game_title: { type: "string", description: "If is_expansion is true, the exact title of the base game this expands (e.g., 'Wingspan' for 'Wingspan: European Expansion')" },
              },
              required: ["title"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_game_data" } },
    });

    if (!aiResult.success) {
      console.error("AI extraction error:", aiResult.error);
      
      if (aiResult.rateLimited) {
        return new Response(
          JSON.stringify({ success: false, error: "Service temporarily busy. Please try again in a moment." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "Failed to extract game data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("AI result:", JSON.stringify(aiResult, null, 2));

    // Define expected structure for extracted data
    interface ExtractedGameData {
      title?: string;
      description?: string;
      difficulty?: string;
      play_time?: string;
      game_type?: string;
      min_players?: number;
      max_players?: number;
      suggested_age?: string;
      mechanics?: string[];
      publisher?: string;
      main_image?: string;
      image_url?: string;
      gameplay_images?: string[];
      additional_images?: string[];
      bgg_url?: string;
      is_expansion?: boolean;
      base_game_title?: string;
    }

    // Extract data from tool call or parse from content
    let extractedData: ExtractedGameData;
    
    if (aiResult.toolCallArguments) {
      extractedData = aiResult.toolCallArguments as ExtractedGameData;
    } else if (aiResult.content) {
      // Try to parse JSON from content (for providers that don't support tools)
      try {
        // Find JSON in the response
        const jsonMatch = aiResult.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]) as ExtractedGameData;
        } else {
          throw new Error("No JSON found in response");
        }
      } catch (parseErr) {
        console.error("Failed to parse AI content as JSON:", parseErr);
        return new Response(
          JSON.stringify({ success: false, error: "Could not parse game data from page" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Could not parse game data from page" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Extracted data:", JSON.stringify(extractedData, null, 2));

    if (!extractedData.title) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not find game title on the page" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Handle mechanics - find or create
    let mechanicIds: string[] = [];
    if (extractedData.mechanics && extractedData.mechanics.length > 0) {
      for (const mechanicName of extractedData.mechanics) {
        // Check if mechanic exists
        const { data: existingMechanic } = await supabaseAdmin
          .from("mechanics")
          .select("id")
          .eq("name", mechanicName)
          .maybeSingle();

        if (existingMechanic) {
          mechanicIds.push(existingMechanic.id);
        } else {
          // Create new mechanic
          const { data: newMechanic, error: mechError } = await supabaseAdmin
            .from("mechanics")
            .insert({ name: mechanicName })
            .select("id")
            .single();
          
          if (newMechanic && !mechError) {
            mechanicIds.push(newMechanic.id);
          }
        }
      }
    }

    // Step 4: Handle publisher - find or create
    let publisherId: string | null = null;
    if (extractedData.publisher) {
      const { data: existingPublisher } = await supabaseAdmin
        .from("publishers")
        .select("id")
        .eq("name", extractedData.publisher)
        .maybeSingle();

      if (existingPublisher) {
        publisherId = existingPublisher.id;
      } else {
        const { data: newPublisher, error: pubError } = await supabaseAdmin
          .from("publishers")
          .insert({ name: extractedData.publisher })
          .select("id")
          .single();
        
        if (newPublisher && !pubError) {
          publisherId = newPublisher.id;
        }
      }
    }

    // Step 4b: Handle expansion detection - try to find parent game in this library
    let detectedParentGameId: string | null = null;
    const aiDetectedExpansion = extractedData.is_expansion === true;
    const aiBaseGameTitle = extractedData.base_game_title;

    if (aiDetectedExpansion && aiBaseGameTitle) {
      console.log("AI detected expansion for base game:", aiBaseGameTitle);
      
      // Try exact match first
      const { data: exactMatch } = await supabaseAdmin
        .from("games")
        .select("id, title")
        .eq("library_id", targetLibraryId)
        .eq("is_expansion", false)
        .ilike("title", aiBaseGameTitle)
        .maybeSingle();

      if (exactMatch) {
        detectedParentGameId = exactMatch.id;
        console.log("Found exact parent game match:", exactMatch.title);
      } else {
        // Try fuzzy match - the base game title might be slightly different
        const { data: fuzzyMatches } = await supabaseAdmin
          .from("games")
          .select("id, title")
          .eq("library_id", targetLibraryId)
          .eq("is_expansion", false)
          .ilike("title", `%${aiBaseGameTitle.split(':')[0].trim()}%`)
          .limit(5);

        if (fuzzyMatches && fuzzyMatches.length === 1) {
          detectedParentGameId = fuzzyMatches[0].id;
          console.log("Found fuzzy parent game match:", fuzzyMatches[0].title);
        } else if (fuzzyMatches && fuzzyMatches.length > 1) {
          console.log("Multiple potential parent games found, skipping auto-link:", fuzzyMatches.map(g => g.title));
        }
      }
    }

    // Step 5: Create the game
    // BGG/Geekdo image URLs sometimes include characters like parentheses in filters (e.g. no_upscale())
    // which can cause HTTP 400 unless properly URL-encoded.
    // Also cleans up malformed URLs from HTML scraping (e.g., &quot;); trailing garbage)
    const sanitizeImageUrl = (imageUrl: string): string => {
      // First, clean malformed URL junk from HTML scraping
      let cleaned = imageUrl
        .replace(/&quot;.*$/i, "")       // Remove &quot; and everything after
        .replace(/["');}\s]+$/g, "")     // Remove trailing quotes, parens, brackets, whitespace
        .replace(/%22.*$/i, "")          // Remove encoded quote and everything after
        .replace(/[\r\n\t]+/g, "")       // Remove any newlines/tabs
        .trim();
      
      if (!cleaned) return imageUrl;
      
      try {
        const u = new URL(cleaned);
        // Ensure special characters are encoded (notably parentheses)
        u.pathname = u.pathname.replace(/\(/g, "%28").replace(/\)/g, "%29");
        // Preserve already-encoded values; URL will normalize safely
        return u.toString();
      } catch {
        return cleaned
          .replace(/\(/g, "%28")
          .replace(/\)/g, "%29");
      }
    };

    // NOTE: We intentionally do NOT try to "validate" image URLs server-side.
    // BGG's image CDN can reject server-side fetches (403/400) even though the same URLs load fine in the browser,
    // which would incorrectly strip images from imports.

    const filterGameplayImages = (images: string[] | undefined): string[] => {
      if (!images || !Array.isArray(images)) return [];

      const filtered = images
        .map((img) => sanitizeImageUrl(img))
        .filter((img) => {
          if (!img || typeof img !== "string") return false;
          // Exclude thumbnails / low-res
          if (/crop100|square30|100x100|150x150|200x200|300x300|thumb/i.test(img)) return false;
          // Don't treat box-art representations as gameplay images
          if (/_itemrep/i.test(img)) return false;
          return true;
        });

      // Deduplicate & limit
      return [...new Set(filtered)].slice(0, 2);
    };

    // Main image (box art) - just sanitize/encode
    const mainImageCandidateRaw = extractedData.main_image || extractedData.image_url;
    const validMainImage: string | null = mainImageCandidateRaw
      ? sanitizeImageUrl(mainImageCandidateRaw)
      : null;

    // Gameplay images - sanitize, filter, ensure not duplicate of main
    const gameplayCandidates = extractedData.gameplay_images || extractedData.additional_images;
    let validGameplayImages = filterGameplayImages(gameplayCandidates);

    // Fallback: if AI didn't pick gameplay images, use the pre-scraped additional images
    if (validGameplayImages.length === 0 && additionalScrapedImages && additionalScrapedImages.length > 0) {
      const fallbackGameplay = additionalScrapedImages
        .filter((img) => {
          if (!img || typeof img !== "string") return false;
          // Exclude tiny thumbnails
          if (/crop100|square30|100x100|150x150|200x200|300x300|thumb/i.test(img)) return false;
          return true;
        })
        .map((img) => sanitizeImageUrl(img));

      validGameplayImages = [...new Set(fallbackGameplay)].slice(0, 5);
    }

    if (validMainImage) validGameplayImages = validGameplayImages.filter((u) => u !== validMainImage);

    // Game data for games table (without admin fields like purchase_price/purchase_date)
    // Normalize enum values to match the current environment's database schema
    const normalizedDifficulty = normalizeDifficulty(extractedData.difficulty) || "3 - Medium";
    const normalizedGameType = normalizeGameType(extractedData.game_type) || "Board Game";
    const normalizedPlayTime = normalizePlayTime(extractedData.play_time) || "45-60 Minutes";
    const normalizedSaleCondition = normalizeSaleCondition(sale_condition);

    const gameData = {
      title: extractedData.title.slice(0, 500),
      description: extractedData.description?.slice(0, 10000) || null, // Increased limit for rich descriptions
      image_url: validMainImage,
      additional_images: validGameplayImages,
      difficulty: normalizedDifficulty,
      game_type: normalizedGameType,
      play_time: normalizedPlayTime,
      min_players: extractedData.min_players || 1,
      max_players: extractedData.max_players || 4,
      suggested_age: extractedData.suggested_age || "10+",
      publisher_id: publisherId,
      bgg_url: extractedData.bgg_url || (url.includes("boardgamegeek.com") ? url : null),
      is_coming_soon: is_coming_soon === true,
      is_for_sale: is_for_sale === true,
      sale_price: is_for_sale === true && sale_price ? Number(sale_price) : null,
      sale_condition: is_for_sale === true ? normalizedSaleCondition : null,
      // Use explicit is_expansion from request, OR auto-detect from AI
      is_expansion: is_expansion === true || aiDetectedExpansion === true,
      // Use explicit parent_game_id from request, OR auto-detected parent
      parent_game_id: is_expansion === true ? parent_game_id : (aiDetectedExpansion ? detectedParentGameId : null),
      location_room: location_room || null,
      location_shelf: location_shelf || null,
      location_misc: location_misc || null,
      sleeved: sleeved === true,
      upgraded_components: upgraded_components === true,
      crowdfunded: crowdfunded === true,
      inserts: inserts === true,
      library_id: targetLibraryId,
    };

    // Upsert: check by bgg_url, bgg_id, or slug to avoid duplicates
    const existingId = await findExistingGame(supabaseAdmin, { ...gameData, bgg_id: bggId || null }, targetLibraryId);

    const write = existingId
      ? supabaseAdmin.from("games").update(gameData).eq("id", existingId).select().single()
      : supabaseAdmin.from("games").insert(gameData).select().single();

    const { data: game, error: gameError } = await write;

    if (gameError) {
      console.error("Game insert error:", gameError);
      throw gameError;
    }

    // Step 6: Handle admin data (purchase_price, purchase_date) in game_admin_data table
    const adminData = {
      game_id: game.id,
      purchase_price: purchase_price ? Number(purchase_price) : null,
      purchase_date: purchase_date || null,
    };

    // Upsert admin data
    const { error: adminError } = await supabaseAdmin
      .from("game_admin_data")
      .upsert(adminData, { onConflict: "game_id" });

    if (adminError) {
      console.warn("Admin data insert warning:", adminError);
      // Don't fail the import for admin data issues
    }

    // Step 7: Link mechanics to game
    if (mechanicIds.length > 0) {
      const mechanicLinks = mechanicIds.map((mechanicId) => ({
        game_id: game.id,
        mechanic_id: mechanicId,
      }));

      await supabaseAdmin.from("game_mechanics").insert(mechanicLinks);
    }

    // Insert BGG community rating mapped to 5-star scale
    if (bggData.bgg_average_rating && bggData.bgg_average_rating > 0) {
      const mapped5Star = Math.max(1, Math.min(5, Math.round(bggData.bgg_average_rating / 2)));
      await supabaseAdmin
        .from("game_ratings")
        .upsert(
          {
            game_id: game.id,
            rating: mapped5Star,
            guest_identifier: "bgg-community",
            source: "bgg",
            ip_address: null,
            device_fingerprint: null,
          },
          { onConflict: "game_id,guest_identifier" }
        );
      console.log(`[GameImport] Saved BGG rating ${bggData.bgg_average_rating}/10 → ${mapped5Star}/5 for "${game.title}"`);
    }

    // Step 7b: Sync additional_images + image_url to game_catalog if BGG-linked
    if (bggId && (validMainImage || validGameplayImages.length > 0)) {
      try {
        const { data: existingCat } = await supabaseAdmin
          .from("game_catalog")
          .select("id, image_url, additional_images")
          .eq("bgg_id", bggId)
          .maybeSingle();

        if (existingCat) {
          const catUpdate: Record<string, unknown> = {};
          if (!existingCat.image_url && validMainImage) catUpdate.image_url = validMainImage;
          if (validGameplayImages.length > 0 && (!existingCat.additional_images || existingCat.additional_images.length === 0)) {
            catUpdate.additional_images = validGameplayImages;
          }
          if (Object.keys(catUpdate).length > 0) {
            await supabaseAdmin.from("game_catalog").update(catUpdate).eq("id", existingCat.id);
          }
        }
      } catch (e) {
        console.warn("[GameImport] catalog additional_images sync failed:", e);
      }
    }

    console.log("Game imported successfully:", game.title);


    // Step 8: Send Discord notification for NEW games only (not updates)
    // Skip HTTP-based notification in self-hosted mode to prevent single-threaded deadlock
    if (!existingId && !IS_SELF_HOSTED) {
      try {
        const playerCount = game.min_players && game.max_players
          ? `${game.min_players}-${game.max_players} players`
          : game.min_players
            ? `${game.min_players}+ players`
            : undefined;

        const discordPayload = {
          library_id: targetLibraryId,
          event_type: "game_added",
          data: {
            title: game.title,
            image_url: game.image_url,
            player_count: playerCount,
            play_time: game.play_time,
          },
        };

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        
        console.log("Sending Discord notification for:", game.title);
        const notifyResponse = await fetch(`${supabaseUrl}/functions/v1/discord-notify`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(discordPayload),
        });
        
        if (notifyResponse.ok) {
          console.log("Discord notification sent successfully");
        } else {
          console.error("Discord notification failed:", await notifyResponse.text());
        }
      } catch (discordErr) {
        console.error("Discord notification error:", discordErr);
      }
    } else if (!existingId) {
      console.log("Self-hosted: skipping Discord HTTP notification to prevent deadlock");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        game: {
          ...game,
          mechanics: extractedData.mechanics || [],
          publisher: extractedData.publisher || null,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Game import error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Import failed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// For Lovable Cloud deployment (direct function invocation)
// Guard so this module can be imported by the self-hosted main router.
if (import.meta.main) {
  Deno.serve(handler);
}
