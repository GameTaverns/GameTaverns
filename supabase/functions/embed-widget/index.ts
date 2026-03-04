import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Embeddable Widget — serves a lightweight HTML widget for library owners
 * to embed on their websites (cafés, stores, etc.)
 * 
 * Usage: /functions/v1/embed-widget?slug=my-library
 * 
 * Script tag approach:
 * <script src="https://gametaverns.com/functions/v1/embed-widget?slug=my-library"></script>
 * 
 * iFrame approach:
 * <iframe src="https://slug.gametaverns.com/embed" ...></iframe>
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || url.searchParams.get("library");
  const format = url.searchParams.get("format") || "js"; // js | html

  if (!slug) {
    return new Response("// Missing library slug", {
      headers: { ...corsHeaders, "Content-Type": "application/javascript" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch library + games
    const { data: library } = await supabase
      .from("libraries")
      .select("id, name, slug, description, logo_url")
      .eq("slug", slug)
      .maybeSingle();

    if (!library) {
      return new Response(format === "js"
        ? `console.warn("GameTaverns: Library '${slug}' not found");`
        : "<p>Library not found</p>", {
        headers: { ...corsHeaders, "Content-Type": format === "js" ? "application/javascript" : "text/html" },
      });
    }

    // Fetch top games (visible, non-expansion)
    const { data: games } = await supabase
      .from("games")
      .select("id, title, slug, image_url, min_players, max_players, play_time")
      .eq("library_id", library.id)
      .eq("is_expansion", false)
      .not("image_url", "is", null)
      .order("title")
      .limit(24);

    const { count: totalGames } = await supabase
      .from("games")
      .select("*", { count: "exact", head: true })
      .eq("library_id", library.id)
      .eq("is_expansion", false);

    const libraryUrl = `https://${slug}.gametaverns.com`;

    if (format === "html" || format === "iframe") {
      return new Response(renderHtmlWidget(library, games || [], totalGames || 0, libraryUrl), {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    // JS format — inject widget into page
    const html = renderHtmlWidget(library, games || [], totalGames || 0, libraryUrl);
    const js = `(function(){
  var container = document.currentScript?.parentNode || document.body;
  var div = document.createElement('div');
  div.className = 'gametaverns-widget';
  div.innerHTML = ${JSON.stringify(html)};
  container.appendChild(div);
})();`;

    return new Response(js, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (e) {
    console.error("[embed-widget] Error:", e);
    return new Response("// Error loading widget", {
      headers: { ...corsHeaders, "Content-Type": "application/javascript" },
    });
  }
}

function renderHtmlWidget(
  library: any,
  games: any[],
  totalGames: number,
  libraryUrl: string,
): string {
  const gameCards = games.map((g) => `
    <a href="${libraryUrl}/game/${g.slug || g.id}" target="_blank" rel="noopener" 
       style="display:flex;flex-direction:column;text-decoration:none;color:inherit;border-radius:8px;overflow:hidden;background:#1a1412;border:1px solid #2a2018;transition:transform 0.2s,box-shadow 0.2s;"
       onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(212,165,116,0.15)'"
       onmouseout="this.style.transform='';this.style.boxShadow=''">
      <img src="${escapeHtml(g.image_url)}" alt="${escapeHtml(g.title)}" 
           style="width:100%;aspect-ratio:1;object-fit:cover;background:#0f0a08;" loading="lazy"/>
      <div style="padding:8px;flex:1">
        <div style="font-size:12px;font-weight:600;color:#f5e6d3;line-height:1.3;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">
          ${escapeHtml(g.title)}
        </div>
        ${g.min_players ? `<div style="font-size:10px;color:#8a7a6a;margin-top:4px;">
          ${g.min_players}${g.max_players && g.max_players !== g.min_players ? `–${g.max_players}` : ""} players
        </div>` : ""}
      </div>
    </a>
  `).join("");

  return `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:800px;background:#0f0a08;border-radius:16px;border:1px solid #2a2018;overflow:hidden;color:#f5e6d3;">
  <!-- Header -->
  <div style="padding:20px 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #2a2018;background:linear-gradient(135deg,#1a0f0a,#2a1810);">
    <div style="display:flex;align-items:center;gap:12px;">
      ${library.logo_url
        ? `<img src="${escapeHtml(library.logo_url)}" alt="" style="width:40px;height:40px;border-radius:8px;object-fit:cover;"/>`
        : `<div style="width:40px;height:40px;border-radius:8px;background:#d4a574;color:#1a0f0a;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:18px;">${escapeHtml(library.name.charAt(0))}</div>`
      }
      <div>
        <div style="font-weight:700;font-size:16px;">${escapeHtml(library.name)}</div>
        <div style="font-size:12px;color:#8a7a6a;">${totalGames} board games</div>
      </div>
    </div>
    <a href="${libraryUrl}" target="_blank" rel="noopener" 
       style="padding:8px 16px;border-radius:8px;background:#d4a574;color:#1a0f0a;text-decoration:none;font-size:13px;font-weight:600;transition:opacity 0.2s;"
       onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
      View Full Collection →
    </a>
  </div>
  
  <!-- Game Grid -->
  <div style="padding:16px 24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;">
    ${gameCards}
  </div>
  
  <!-- Footer -->
  <div style="padding:12px 24px;border-top:1px solid #2a2018;display:flex;align-items:center;justify-content:space-between;">
    <a href="https://gametaverns.com" target="_blank" rel="noopener" style="font-size:11px;color:#8a7a6a;text-decoration:none;">
      Powered by 🍺 GameTaverns
    </a>
    ${totalGames > 24 ? `<a href="${libraryUrl}" target="_blank" rel="noopener" style="font-size:12px;color:#d4a574;text-decoration:none;">View all ${totalGames} games →</a>` : ""}
  </div>
</div>`;
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
