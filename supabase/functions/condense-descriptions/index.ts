import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiComplete, isAIConfigured, getAIProviderName } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check admin role
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

    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || 10;
    const startOffset = body.offset || 0;

    // Get games that need updating (have long descriptions)
    const { data: games, error: gamesError } = await supabaseAdmin
      .from("games")
      .select("id, title, description")
      .not("description", "is", null)
      .neq("description", "")
      .order("title")
      .range(startOffset, startOffset + batchSize - 1);

    if (gamesError) {
      console.error("Error fetching games:", gamesError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch games" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!games || games.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No more games to process", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isAIConfigured()) {
      return new Response(
        JSON.stringify({ success: false, error: "AI service not configured. Set PERPLEXITY_API_KEY or OPENAI_API_KEY." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Using AI provider: ${getAIProviderName()}`);

    let updated = 0;
    const errors: string[] = [];

    for (const game of games) {
      try {
        console.log(`Processing: ${game.title}`);

        // Skip if already concise (less than 800 chars is probably already good)
        if (game.description.length < 800) {
          console.log(`Skipping ${game.title} - already concise`);
          continue;
        }

        const aiResult = await aiComplete({
          messages: [
            {
              role: "system",
              content: `You are a board game description editor. Your task is to CONDENSE existing game descriptions into a CONCISE format.

OUTPUT FORMAT (follow this EXACTLY):
1. Opening paragraph: 2-3 sentences max about the game theme and what makes it special
2. "## Quick Gameplay Overview" header
3. Bullet points with bold labels:
   - **Goal:** One sentence
   - **Each Round:** or **On Your Turn:** 3-4 bullet points with bold action names, each ONE LINE max
   - **End Game:** One sentence (optional if obvious)
   - **Winner:** One sentence
4. One closing sentence about the edition/components (optional, only if relevant)

CRITICAL RULES:
- Total length: 150-200 words MAX
- Each bullet point must fit on ONE LINE
- Remove all verbose explanations
- Keep only essential gameplay info
- Use em-dashes for sub-bullets if needed`
              },
            {
              role: "user",
              content: `Condense this game description for "${game.title}":\n\n${game.description}`
            }
          ],
          max_tokens: 500,
        });

        if (!aiResult.success) {
          console.error(`AI error for ${game.title}:`, aiResult.error);
          
          if (aiResult.rateLimited) {
            errors.push(`Rate limited at ${game.title}`);
            break; // Stop processing on rate limit
          }
          errors.push(`Failed to process ${game.title}`);
          continue;
        }

        const newDescription = aiResult.content;

        if (!newDescription) {
          errors.push(`No content returned for ${game.title}`);
          continue;
        }

        // Update the game
        const { error: updateError } = await supabaseAdmin
          .from("games")
          .update({ description: newDescription.trim() })
          .eq("id", game.id);

        if (updateError) {
          console.error(`Update error for ${game.title}:`, updateError);
          errors.push(`Failed to update ${game.title}`);
          continue;
        }

        updated++;
        console.log(`Updated: ${game.title}`);

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`Error processing ${game.title}:`, err);
        errors.push(`Error processing ${game.title}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        processed: games.length,
        nextOffset: startOffset + batchSize,
        errors: errors.length > 0 ? errors : undefined,
        message: `Updated ${updated} of ${games.length} games. Next offset: ${startOffset + batchSize}`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Condense descriptions error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// For Lovable Cloud deployment (direct function invocation)
Deno.serve(handler);
