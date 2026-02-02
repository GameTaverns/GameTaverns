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

    // Check if user is either a global admin OR owns a library
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    const { data: libraryData } = await supabaseAdmin
      .from("libraries")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();

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
        if (/\/pic\d+/i.test(url)) return 3; // Standard BGG image format
        return 4; // Other images
      };
      return getPriority(a) - getPriority(b);
    });
    
    // Take the first image as main (box art preferred), then additional images
    const mainImage = sortedImageLinks[0] || null;
    // Get up to 5 additional images (excluding the main one)
    const additionalScrapedImages = sortedImageLinks.slice(1, 6);

    console.log("Found image links:", sortedImageLinks.length, "main:", !!mainImage, "additional:", additionalScrapedImages.length);
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
   - Example: "Wingspan: European Expansion" → is_expansion: true, base_game_title: "Wingspan"`,
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

    // Upsert: if we already have a game for this BGG URL in this library, update it instead of inserting a duplicate.
    let existingId: string | null = null;
    if (gameData.bgg_url) {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("games")
        .select("id")
        .eq("bgg_url", gameData.bgg_url)
        .eq("library_id", targetLibraryId)
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

    console.log("Game imported successfully:", game.title);

    // Step 8: Send Discord notification for NEW games only (not updates)
    if (!existingId) {
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

        // Call discord-notify function - must await to prevent edge function from terminating early
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
        // Don't fail the import for notification issues
      }
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
Deno.serve(handler);
