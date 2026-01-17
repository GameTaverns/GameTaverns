import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Difficulty levels from the database enum
const DIFFICULTY_LEVELS = [
  "1 - Light",
  "2 - Medium Light",
  "3 - Medium",
  "4 - Medium Heavy",
  "5 - Heavy",
];

// Play time options from database enum
const PLAY_TIME_OPTIONS = [
  "0-15 Minutes",
  "15-30 Minutes",
  "30-45 Minutes",
  "45-60 Minutes",
  "60+ Minutes",
  "2+ Hours",
  "3+ Hours",
];

// Game type options from database enum
const GAME_TYPE_OPTIONS = [
  "Board Game",
  "Card Game",
  "Dice Game",
  "Party Game",
  "War Game",
  "Miniatures",
  "RPG",
  "Other",
];

Deno.serve(async (req) => {
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

    // Verify the user token
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    // Create admin client with service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if user has admin role
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

    const { url, is_coming_soon, is_for_sale, sale_price, sale_condition, is_expansion, parent_game_id, location_room, location_shelf } = await req.json();

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

    console.log("Importing game from URL:", url);

    // Step 1: Use Firecrawl to scrape the page
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      console.error("Firecrawl API key not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Import service temporarily unavailable. Please try again later." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract BGG ID for validation
    const bggIdMatch = url.match(/boardgame\/(\d+)/);
    const bggId = bggIdMatch?.[1];

    console.log("Scraping with Firecrawl...");
    
    // Only scrape the main page - no gallery to avoid pulling irrelevant images
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
        return 3; // Other images
      };
      return getPriority(a) - getPriority(b);
    });
    
    // Take only the first image (box art preferred) for simplicity
    const mainImage = sortedImageLinks[0] || null;

    console.log("Found image links:", sortedImageLinks.length);
    console.log("Main image:", mainImage);

    // Guardrail: ensure the scraped content actually matches the requested BGG game page
    // (BGG sometimes serves "hotness"/generic content when blocked).
    const requestedBggId = bggId;
    if (requestedBggId) {
      const looksLikeRightPage =
        typeof markdown === "string" &&
        (markdown.includes(requestedBggId) || markdown.toLowerCase().includes(url.toLowerCase()));

      if (!looksLikeRightPage) {
        console.error("Scrape mismatch: content does not appear to be for requested game", {
          url,
          requestedBggId,
        });
        return new Response(
          JSON.stringify({
            success: false,
            error:
              "Could not reliably read that BoardGameGeek page (it returned unrelated content). Please try again in a moment.",
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!markdown) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not extract content from the page" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Scraped content length:", markdown.length);

    // Step 2: Use AI to extract structured game data
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      console.error("Lovable AI API key not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Import service temporarily unavailable. Please try again later." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Extracting game data with AI...");
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a board game data extraction expert. Extract detailed, structured game information from the provided content.

IMPORTANT RULES:

1. For enum fields, you MUST use these EXACT values:
   - difficulty: ${DIFFICULTY_LEVELS.map(d => `"${d}"`).join(", ")}
   - play_time: ${PLAY_TIME_OPTIONS.map(p => `"${p}"`).join(", ")}
   - game_type: ${GAME_TYPE_OPTIONS.map(t => `"${t}"`).join(", ")}

2. For the DESCRIPTION field, create a COMPREHENSIVE, DETAILED description that includes:
   - An engaging overview paragraph about the game
   - A "## Quick Gameplay Overview" section with:
     - **Goal:** What players are trying to achieve
     - **On Your Turn:** The main actions players can take (use numbered lists)
     - **Scoring:** How points are earned
     - **End Game:** When and how the game ends
   - A closing paragraph about the game's appeal/experience
   
   Use markdown formatting with headers (##), bold (**text**), and bullet points.
   Make it detailed and informative - aim for 300-500 words.

3. For IMAGES - VERY SIMPLE RULES:
   - You are given a SHORT list of official box art images
   - For main_image: Use the FIRST image with "_itemrep" (box art) - this is the ONLY main image
   - For gameplay_images: Leave as EMPTY ARRAY [] - we only want box art, no extra images
   - DO NOT include any gameplay, component, or user-submitted photos

4. For mechanics, extract actual game mechanics (e.g., "Worker Placement", "Set Collection", "Dice Rolling").

5. For publisher, extract the publisher company name.`,
          },
          {
            role: "user",
            content: `Extract comprehensive board game data from this page content.

TARGET PAGE (must match): ${url}

AVAILABLE BOX ART IMAGE (use ONLY this for main_image, leave gameplay_images empty):
${mainImage || "No image found"}

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
                    description: "Comprehensive game description with markdown formatting. Include overview, Quick Gameplay Overview section with Goal/Turn Actions/Scoring/End Game, and closing appeal paragraph. Aim for 300-500 words." 
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
                },
                required: ["title"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_game_data" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI extraction error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429 || aiResponse.status === 402) {
        console.error("AI service limit reached:", aiResponse.status);
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

    const aiData = await aiResponse.json();
    console.log("AI response:", JSON.stringify(aiData, null, 2));

    // Extract the tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not parse game data from page" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extractedData = JSON.parse(toolCall.function.arguments);
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

    // Step 5: Create the game
    // BGG/Geekdo image URLs sometimes include characters like parentheses in filters (e.g. no_upscale())
    // which can cause HTTP 400 unless properly URL-encoded.
    const sanitizeImageUrl = (imageUrl: string): string => {
      try {
        const u = new URL(imageUrl);
        // Ensure special characters are encoded (notably parentheses)
        u.pathname = u.pathname.replace(/\(/g, "%28").replace(/\)/g, "%29");
        // Preserve already-encoded values; URL will normalize safely
        return u.toString();
      } catch {
        return imageUrl
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

    // Fallback: if AI didn't pick gameplay images, derive them from the scraped image list.
    if (validGameplayImages.length === 0) {
      const fallbackGameplay = (sortedImageLinks || [])
        .filter((img) => {
          if (!img || typeof img !== "string") return false;
          if (/crop100|square30|100x100|150x150|200x200|300x300|thumb/i.test(img)) return false;
          if (/_itemrep/i.test(img)) return false; // avoid box-art reps
          // Prefer full-size gallery photos
          return /__imagepage\//i.test(img) || /\/pic\d+\./i.test(img);
        })
        .slice(0, 6)
        .map((img) => sanitizeImageUrl(img));

      validGameplayImages = [...new Set(fallbackGameplay)].slice(0, 6);
    }

    if (validMainImage) validGameplayImages = validGameplayImages.filter((u) => u !== validMainImage);

    const gameData = {
      title: extractedData.title.slice(0, 500),
      description: extractedData.description?.slice(0, 10000) || null, // Increased limit for rich descriptions
      image_url: validMainImage,
      additional_images: validGameplayImages,
      difficulty: extractedData.difficulty || "3 - Medium",
      game_type: extractedData.game_type || "Board Game",
      play_time: extractedData.play_time || "45-60 Minutes",
      min_players: extractedData.min_players || 1,
      max_players: extractedData.max_players || 4,
      suggested_age: extractedData.suggested_age || "10+",
      publisher_id: publisherId,
      bgg_url: extractedData.bgg_url || (url.includes("boardgamegeek.com") ? url : null),
      is_coming_soon: is_coming_soon === true,
      is_for_sale: is_for_sale === true,
      sale_price: is_for_sale === true && sale_price ? Number(sale_price) : null,
      sale_condition: is_for_sale === true && sale_condition ? sale_condition : null,
      is_expansion: is_expansion === true,
      parent_game_id: is_expansion === true ? parent_game_id : null,
      location_room: location_room || null,
      location_shelf: location_shelf || null,
    };

    // Upsert: if we already have a game for this BGG URL, update it instead of inserting a duplicate slug.
    let existingId: string | null = null;
    if (gameData.bgg_url) {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("games")
        .select("id")
        .eq("bgg_url", gameData.bgg_url)
        .maybeSingle();
      if (existingError) throw existingError;
      existingId = existing?.id ?? null;
    }

    const write = existingId
      ? supabaseAdmin.from("games").update(gameData).eq("id", existingId).select().single()
      : supabaseAdmin.from("games").insert(gameData).select().single();

    const { data: game, error: gameError } = await write;

    if (gameError) {
      console.error("Game insert error:", gameError);
      throw gameError;
    }

    // Step 6: Link mechanics to game
    if (mechanicIds.length > 0) {
      const mechanicLinks = mechanicIds.map((mechanicId) => ({
        game_id: game.id,
        mechanic_id: mechanicId,
      }));

      await supabaseAdmin.from("game_mechanics").insert(mechanicLinks);
    }

    console.log("Game imported successfully:", game.title);

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
});
