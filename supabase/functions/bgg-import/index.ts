import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Helper to get allowed origins
const getAllowedOrigins = (): string[] => {
  const origins = [
    Deno.env.get("ALLOWED_ORIGIN") || "",
    "http://localhost:5173",
    "http://localhost:8080",
  ].filter(Boolean);
  
  // Add production URL pattern
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (supabaseUrl) {
    // Extract project ID and allow lovable.app domains
    const projectMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (projectMatch) {
      origins.push(`https://${projectMatch[1]}.lovable.app`);
    }
  }
  
  return origins;
};

// Get CORS headers with origin validation
const getCorsHeaders = (requestOrigin: string | null): Record<string, string> => {
  const allowedOrigins = getAllowedOrigins();
  const isAllowedOrigin = requestOrigin && (
    allowedOrigins.some(allowed => requestOrigin === allowed) ||
    requestOrigin.endsWith('.lovable.app') ||
    requestOrigin.endsWith('.lovableproject.com')
  );
  const origin = isAllowedOrigin ? requestOrigin : allowedOrigins[0] || "*";
  
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
};

// Input validation helpers
const sanitizeString = (str: string, maxLength: number): string => {
  return str
    .replace(/&#10;/g, "\n")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "") // Remove any HTML tags
    .trim()
    .slice(0, maxLength);
};

const isValidUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const isValidBggId = (id: string): boolean => {
  return /^\d{1,10}$/.test(id);
};

Deno.serve(async (req) => {
  const requestOrigin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(requestOrigin);

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

    // Verify the user token using getClaims
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    // Create admin client with service role to check user_roles table
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if user has admin role in user_roles table
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ success: false, error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { url } = await req.json();
    
    // Validate input URL
    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract BGG ID from URL
    const bggIdMatch = url.match(/boardgamegeek\.com\/boardgame\/(\d+)/);
    if (!bggIdMatch) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid BoardGameGeek URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bggId = bggIdMatch[1];
    
    // Validate BGG ID format
    if (!isValidBggId(bggId)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid BGG ID format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Fetch from BGG XML API with timeout and retry logic
    // BGG API sometimes returns 202 (queued) and needs a retry
    // Use api.geekdo.com (BGG's API host) to avoid web protections on boardgamegeek.com.
    const apiUrl = `https://api.geekdo.com/xmlapi2/thing?id=${bggId}&stats=1`;
    
    const fetchWithRetry = async (url: string, maxRetries = 3): Promise<Response> => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(30000),
          headers: {
            Accept: "application/xml,text/xml,*/*",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            Referer: "https://boardgamegeek.com/",
          },
        });
        
        // BGG returns 202 when request is queued - need to retry after delay
        if (response.status === 202) {
          console.log(`BGG returned 202 (queued), retry ${attempt + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          continue;
        }
        
        return response;
      }
      throw new Error("BGG API queued too many times");
    };
    
    let bggResponse: Response;
    try {
      bggResponse = await fetchWithRetry(apiUrl);
    } catch (fetchError) {
      console.error("BGG API fetch failed:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch from BoardGameGeek (timeout or network error)" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!bggResponse.ok) {
      console.error("BGG API error:", bggResponse.status, await bggResponse.text());
      return new Response(
        JSON.stringify({ success: false, error: `BoardGameGeek API returned status ${bggResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const xmlText = await bggResponse.text();
    
    // Validate XML response size (prevent DoS from huge responses)
    if (xmlText.length > 500000) { // 500KB max
      return new Response(
        JSON.stringify({ success: false, error: "Response from BoardGameGeek too large" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse XML with validation
    const getName = (xml: string): string => {
      const match = xml.match(/<name type="primary" value="([^"]+)"/);
      const rawName = match ? match[1] : "Unknown Game";
      return sanitizeString(rawName, 500); // Max 500 chars for title
    };

    const getDescription = (xml: string): string | null => {
      const match = xml.match(/<description>([^<]*)<\/description>/s);
      if (!match) return null;
      return sanitizeString(match[1], 2000); // Max 2000 chars for description
    };

    const getImage = (xml: string): string | null => {
      const match = xml.match(/<image>([^<]+)<\/image>/);
      if (!match) return null;
      const imageUrl = match[1].trim().slice(0, 2048); // Max 2048 chars for URL
      // Validate it's a proper URL
      return isValidUrl(imageUrl) ? imageUrl : null;
    };

    // Fetch additional images from the BGG images page
    const getAdditionalImages = async (bggId: string): Promise<string[]> => {
      try {
        // Fetch the images page for this game
        const imagesPageUrl = `https://boardgamegeek.com/boardgame/${bggId}/images`;
        const response = await fetch(imagesPageUrl, {
          signal: AbortSignal.timeout(15000),
          headers: {
            'Accept': 'text/html',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        
        if (!response.ok) {
          console.log("Failed to fetch images page:", response.status);
          return [];
        }
        
        const html = await response.text();
        
        // Extract image URLs from the HTML - BGG embeds them in various formats
        // Look for cf.geekdo-images.com URLs in the page
        const imageUrlRegex = /https:\/\/cf\.geekdo-images\.com\/[^"'\s<>]+\.(jpg|jpeg|png|webp)/gi;
        const matches = html.match(imageUrlRegex) || [];
        
        // Deduplicate and filter
        const uniqueUrls = [...new Set(matches)]
          // Filter out tiny thumbnails (usually contain __thumb or very small dimensions)
          .filter(url => !url.includes('__thumb') && !url.includes('__micro'))
          // Prefer larger image versions
          .filter(url => url.includes('__imagepage') || url.includes('__original') || url.includes('__large'))
          // Limit to reasonable number
          .slice(0, 10);
        
        console.log(`Found ${uniqueUrls.length} additional images for BGG ID ${bggId}`);
        return uniqueUrls;
      } catch (error) {
        console.error("Error fetching additional images:", error);
        return [];
      }
    };

    const getMinPlayers = (xml: string): number => {
      const match = xml.match(/<minplayers value="(\d+)"/);
      const value = match ? parseInt(match[1], 10) : 1;
      return Math.min(Math.max(value, 1), 100); // Clamp between 1-100
    };

    const getMaxPlayers = (xml: string): number => {
      const match = xml.match(/<maxplayers value="(\d+)"/);
      const value = match ? parseInt(match[1], 10) : 4;
      return Math.min(Math.max(value, 1), 1000); // Clamp between 1-1000
    };

    const getPlayTime = (xml: string): string => {
      const match = xml.match(/<playingtime value="(\d+)"/);
      const time = match ? parseInt(match[1], 10) : 45;
      if (time <= 15) return "0-15 Minutes";
      if (time <= 30) return "15-30 Minutes";
      if (time <= 45) return "30-45 Minutes";
      if (time <= 60) return "45-60 Minutes";
      if (time <= 120) return "60+ Minutes";
      if (time <= 180) return "2+ Hours";
      return "3+ Hours";
    };

    const getWeight = (xml: string): string => {
      const match = xml.match(/<averageweight value="([\d.]+)"/);
      const weight = match ? parseFloat(match[1]) : 2.5;
      if (weight < 1.5) return "1 - Light";
      if (weight < 2.5) return "2 - Medium Light";
      if (weight < 3.5) return "3 - Medium";
      if (weight < 4.5) return "4 - Medium Heavy";
      return "5 - Heavy";
    };

    const getAge = (xml: string): string => {
      const match = xml.match(/<minage value="(\d+)"/);
      const age = match ? Math.min(parseInt(match[1], 10), 99) : 10;
      return `${age}+`;
    };

    const title = getName(xmlText);
    
    // Fetch additional images from BGG gallery (don't block on failure)
    const additionalImages = await getAdditionalImages(bggId);
    
    const gameData = {
      title,
      description: getDescription(xmlText),
      image_url: getImage(xmlText),
      additional_images: additionalImages,
      difficulty: getWeight(xmlText),
      game_type: "Board Game",
      play_time: getPlayTime(xmlText),
      min_players: getMinPlayers(xmlText),
      max_players: getMaxPlayers(xmlText),
      suggested_age: getAge(xmlText),
      bgg_id: bggId.slice(0, 20), // Max 20 chars for BGG ID
      bgg_url: url.slice(0, 2048), // Max 2048 chars for URL
    };

    // Upsert behavior: if this BGG game already exists, update images/metadata instead of inserting a duplicate.
    const { data: existingGame, error: existingError } = await supabaseAdmin
      .from("games")
      .select("id")
      .or(`bgg_id.eq.${bggId},bgg_url.eq.${url}`)
      .maybeSingle();

    if (existingError) throw existingError;

    const write = existingGame
      ? supabaseAdmin
          .from("games")
          .update(gameData)
          .eq("id", existingGame.id)
          .select()
          .single()
      : supabaseAdmin.from("games").insert(gameData).select().single();

    const { data, error } = await write;

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, game: data, updated: !!existingGame }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("BGG import error:", error);
    // Return generic error message to avoid leaking internal details
    return new Response(
      JSON.stringify({ success: false, error: "Import failed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
