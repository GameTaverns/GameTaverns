const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type BggLookupResponse = {
  success: boolean;
  data?: {
    bgg_id: string;
    title: string | null;
    image_url: string | null;
    min_players: number | null;
    max_players: number | null;
    suggested_age: string | null;
    // We map to app enums loosely on the client; keep this simple.
    playing_time_minutes: number | null;
  };
  error?: string;
};

function extractAttr(xml: string, tag: string, attr: string): string | null {
  const re = new RegExp(`<${tag}[^>]*\\b${attr}="([^"]+)"[^>]*>`, "i");
  const m = xml.match(re);
  return m?.[1] ?? null;
}

function extractTagText(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m?.[1]?.trim() ?? null;
}

function extractPrimaryName(xml: string): string | null {
  // <name type="primary" value="Catan"/>
  const re = /<name[^>]*\btype="primary"[^>]*\bvalue="([^"]+)"[^>]*\/?>(?:<\/name>)?/i;
  const m = xml.match(re);
  return m?.[1] ?? null;
}

function extractMetaContent(html: string, propertyOrName: string): string | null {
  // matches: <meta property="og:title" content="...">
  const re = new RegExp(
    `<meta[^>]+(?:property|name)="${propertyOrName}"[^>]+content="([^"]+)"[^>]*>`,
    "i"
  );
  const m = html.match(re);
  return m?.[1]?.trim() ?? null;
}

function pickBestGeekdoImage(html: string): string | null {
  const imageRegex = /https?:\/\/cf\.geekdo-images\.com[^\s"'<>]+/g;
  const all = html.match(imageRegex) || [];
  const unique = [...new Set(all)];

  const filtered = unique.filter((img) => !/crop100|square30|100x100|150x150|_thumb|_avatar|_micro/i.test(img));

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method Not Allowed" } satisfies BggLookupResponse), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => null);
    const urlOrId = body?.url ?? body?.bgg_id;

    if (!urlOrId || typeof urlOrId !== "string") {
      return new Response(JSON.stringify({ success: false, error: "url or bgg_id is required" } satisfies BggLookupResponse), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const idMatch = urlOrId.match(/(?:boardgame\/(\d+))|(\d+)/);
    const bggId = idMatch?.[1] ?? idMatch?.[2];

    if (!bggId) {
      return new Response(JSON.stringify({ success: false, error: "Could not determine BGG id" } satisfies BggLookupResponse), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const endpoints = [
      // Some hosting environments get blocked on boardgamegeek.com; api.geekdo.com often works better.
      `https://api.geekdo.com/xmlapi2/thing?id=${encodeURIComponent(bggId)}&stats=1`,
      `https://boardgamegeek.com/xmlapi2/thing?id=${encodeURIComponent(bggId)}&stats=1`,
    ];

    let upstream: Response | null = null;
    let lastStatus: number | null = null;
    let lastBody = "";

    for (const apiUrl of endpoints) {
      upstream = await fetch(apiUrl, {
        method: "GET",
        headers: {
          // Use a standard browser UA to avoid being treated as a bot.
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/xml,text/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });

      if (upstream.ok) break;

      lastStatus = upstream.status;
      lastBody = await upstream.text().catch(() => "");

      // If we're getting blocked, try the next endpoint.
      if ([401, 403, 429].includes(upstream.status)) continue;

      // For other errors, no point retrying other endpoints.
      break;
    }

    if (!upstream || !upstream.ok) {
      const status = upstream?.status ?? lastStatus ?? 0;

      // Fallback: if BGG blocks our backend IP, use Firecrawl to fetch the BGG page.
      if ([401, 403, 429].includes(status)) {
        const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
        if (firecrawlKey) {
          const pageUrl = `https://boardgamegeek.com/boardgame/${encodeURIComponent(bggId)}`;

          const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${firecrawlKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: pageUrl,
              formats: ["rawHtml"],
              onlyMainContent: true,
            }),
          });

          if (scrapeResponse.ok) {
            const scrapeData = await scrapeResponse.json();
            const rawHtml = scrapeData.data?.rawHtml || scrapeData.rawHtml || "";

            const title =
              extractMetaContent(rawHtml, "og:title") ||
              extractMetaContent(rawHtml, "twitter:title") ||
              null;

            const imageUrl =
              extractMetaContent(rawHtml, "og:image") ||
              extractMetaContent(rawHtml, "twitter:image") ||
              pickBestGeekdoImage(rawHtml);

            const resp: BggLookupResponse = {
              success: true,
              data: {
                bgg_id: bggId,
                title,
                image_url: imageUrl,
                min_players: null,
                max_players: null,
                suggested_age: null,
                playing_time_minutes: null,
              },
            };

            return new Response(JSON.stringify(resp), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: `BGG request failed (${status})`,
        } satisfies BggLookupResponse),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const xml = await upstream.text();

    const title = extractPrimaryName(xml);
    const imageUrl = extractTagText(xml, "image");

    const minPlayersRaw = extractAttr(xml, "minplayers", "value");
    const maxPlayersRaw = extractAttr(xml, "maxplayers", "value");
    const playingTimeRaw = extractAttr(xml, "playingtime", "value");
    const ageRaw = extractAttr(xml, "minage", "value");

    const minPlayers = minPlayersRaw ? Number(minPlayersRaw) : null;
    const maxPlayers = maxPlayersRaw ? Number(maxPlayersRaw) : null;
    const playingTimeMinutes = playingTimeRaw ? Number(playingTimeRaw) : null;

    const suggestedAge = ageRaw && ageRaw !== "0" ? `${ageRaw}+` : null;

    const resp: BggLookupResponse = {
      success: true,
      data: {
        bgg_id: bggId,
        title,
        image_url: imageUrl,
        min_players: Number.isFinite(minPlayers as number) ? minPlayers : null,
        max_players: Number.isFinite(maxPlayers as number) ? maxPlayers : null,
        suggested_age: suggestedAge,
        playing_time_minutes: Number.isFinite(playingTimeMinutes as number) ? playingTimeMinutes : null,
      },
    };

    return new Response(JSON.stringify(resp), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("bgg-lookup error", e);
    return new Response(JSON.stringify({ success: false, error: "Lookup failed" } satisfies BggLookupResponse), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
