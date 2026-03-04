import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "public, max-age=3600, s-maxage=86400",
};

/**
 * OG Image Generator — returns a branded SVG card for library sharing.
 * 
 * Usage: /functions/v1/og-image?slug=my-library
 * 
 * Returns an SVG image suitable for og:image meta tags.
 * Crawlers that need PNG can use: ?slug=my-library&format=png (future)
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    const type = url.searchParams.get("type") || "library"; // library | game | profile

    if (!slug) {
      return new Response("Missing slug parameter", { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    if (type === "library") {
      return await generateLibraryCard(supabase, slug);
    }

    return new Response("Invalid type", { status: 400, headers: corsHeaders });
  } catch (e) {
    console.error("[og-image] Error:", e);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
}

async function generateLibraryCard(supabase: any, slug: string): Promise<Response> {
  // Fetch library data
  const { data: library } = await supabase
    .from("libraries")
    .select("id, name, slug, description, logo_url")
    .eq("slug", slug)
    .maybeSingle();

  if (!library) {
    return generateFallbackCard("Library not found");
  }

  // Fetch game count and top game images
  const [countRes, topGamesRes, membersRes] = await Promise.all([
    supabase.from("games").select("*", { count: "exact", head: true })
      .eq("library_id", library.id).eq("is_expansion", false),
    supabase.from("games").select("title, image_url")
      .eq("library_id", library.id).eq("is_expansion", false)
      .not("image_url", "is", null)
      .limit(6),
    supabase.from("library_members").select("*", { count: "exact", head: true })
      .eq("library_id", library.id),
  ]);

  const gameCount = countRes.count || 0;
  const memberCount = (membersRes.count || 0) + 1; // +1 for owner
  const topGames = topGamesRes.data || [];
  const description = library.description || `${gameCount} board games available to browse, borrow, and play.`;

  const svg = renderLibrarySvg({
    name: library.name,
    gameCount,
    memberCount,
    description: description.slice(0, 120),
    gameImages: topGames.slice(0, 4).map((g: any) => g.image_url),
  });

  return new Response(svg, {
    headers: {
      ...corsHeaders,
      "Content-Type": "image/svg+xml",
    },
  });
}

function generateFallbackCard(text: string): Response {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#1a1412"/>
    <text x="600" y="315" text-anchor="middle" fill="#d4a574" font-size="32" font-family="Georgia, serif">${escapeXml(text)}</text>
  </svg>`;
  return new Response(svg, {
    headers: { ...corsHeaders, "Content-Type": "image/svg+xml" },
  });
}

interface LibraryCardData {
  name: string;
  gameCount: number;
  memberCount: number;
  description: string;
  gameImages: string[];
}

function renderLibrarySvg(data: LibraryCardData): string {
  const { name, gameCount, memberCount, description } = data;

  // Tavern-themed warm color palette
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a0f0a"/>
      <stop offset="50%" style="stop-color:#2a1810"/>
      <stop offset="100%" style="stop-color:#1a1412"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#d4a574"/>
      <stop offset="100%" style="stop-color:#c4956a"/>
    </linearGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#d4a574;stop-opacity:0.3"/>
      <stop offset="100%" style="stop-color:#d4a574;stop-opacity:0"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  
  <!-- Subtle texture pattern -->
  <rect width="1200" height="630" fill="url(#glow)" opacity="0.15"/>
  
  <!-- Top accent line -->
  <rect x="0" y="0" width="1200" height="4" fill="url(#accent)"/>
  
  <!-- Decorative corner elements -->
  <path d="M60 60 L60 90 M60 60 L90 60" stroke="#d4a574" stroke-width="2" opacity="0.4" fill="none"/>
  <path d="M1140 60 L1140 90 M1140 60 L1110 60" stroke="#d4a574" stroke-width="2" opacity="0.4" fill="none"/>
  <path d="M60 570 L60 540 M60 570 L90 570" stroke="#d4a574" stroke-width="2" opacity="0.4" fill="none"/>
  <path d="M1140 570 L1140 540 M1140 570 L1110 570" stroke="#d4a574" stroke-width="2" opacity="0.4" fill="none"/>

  <!-- Library Name -->
  <text x="100" y="200" fill="#f5e6d3" font-size="52" font-weight="bold" font-family="Georgia, 'Times New Roman', serif">
    ${escapeXml(truncate(name, 28))}
  </text>
  
  <!-- Description -->
  <text x="100" y="260" fill="#c4a882" font-size="22" font-family="system-ui, -apple-system, sans-serif" opacity="0.8">
    ${escapeXml(truncate(description, 70))}
  </text>
  
  <!-- Stats Row -->
  <g transform="translate(100, 320)">
    <!-- Games stat -->
    <rect x="0" y="0" width="180" height="80" rx="12" fill="#d4a574" fill-opacity="0.12" stroke="#d4a574" stroke-opacity="0.25" stroke-width="1"/>
    <text x="90" y="35" text-anchor="middle" fill="#d4a574" font-size="28" font-weight="bold" font-family="Georgia, serif">
      ${gameCount}
    </text>
    <text x="90" y="60" text-anchor="middle" fill="#c4a882" font-size="14" font-family="system-ui, sans-serif" opacity="0.7">
      Board Games
    </text>
    
    <!-- Members stat -->
    <rect x="200" y="0" width="180" height="80" rx="12" fill="#d4a574" fill-opacity="0.12" stroke="#d4a574" stroke-opacity="0.25" stroke-width="1"/>
    <text x="290" y="35" text-anchor="middle" fill="#d4a574" font-size="28" font-weight="bold" font-family="Georgia, serif">
      ${memberCount}
    </text>
    <text x="290" y="60" text-anchor="middle" fill="#c4a882" font-size="14" font-family="system-ui, sans-serif" opacity="0.7">
      ${memberCount === 1 ? "Member" : "Members"}
    </text>
  </g>

  <!-- Dice icon decoration -->
  <g transform="translate(950, 180)" opacity="0.08">
    <rect x="0" y="0" width="160" height="160" rx="24" fill="#d4a574"/>
    <circle cx="50" cy="50" r="12" fill="#1a0f0a"/>
    <circle cx="110" cy="50" r="12" fill="#1a0f0a"/>
    <circle cx="80" cy="80" r="12" fill="#1a0f0a"/>
    <circle cx="50" cy="110" r="12" fill="#1a0f0a"/>
    <circle cx="110" cy="110" r="12" fill="#1a0f0a"/>
  </g>
  
  <!-- Bottom bar -->
  <rect x="0" y="530" width="1200" height="100" fill="#0f0a08"/>
  <rect x="0" y="530" width="1200" height="1" fill="#d4a574" opacity="0.2"/>
  
  <!-- GameTaverns branding -->
  <text x="100" y="575" fill="#d4a574" font-size="18" font-weight="bold" font-family="Georgia, serif" letter-spacing="1">
    🍺 GameTaverns
  </text>
  <text x="100" y="600" fill="#8a7a6a" font-size="13" font-family="system-ui, sans-serif">
    gametaverns.com — Track, lend, and share your board game collection
  </text>
  
  <!-- URL -->
  <text x="1100" y="580" text-anchor="end" fill="#c4a882" font-size="16" font-family="system-ui, sans-serif" opacity="0.6">
    ${escapeXml(truncate(name, 20).toLowerCase().replace(/\s+/g, "-"))}.gametaverns.com
  </text>
</svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + "…";
}

if (import.meta.main) {
  Deno.serve(handler);
}
