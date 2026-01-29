import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GameData {
  id: string;
  title: string;
  description: string | null;
  difficulty: string | null;
  play_time: string | null;
  game_type: string | null;
  min_players: number | null;
  max_players: number | null;
  mechanics: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { game_id, library_id, limit = 5 } = await req.json();

    if (!game_id || !library_id) {
      return new Response(
        JSON.stringify({ error: "game_id and library_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the source game
    const { data: sourceGame, error: sourceError } = await supabase
      .from("games")
      .select(`
        id, title, description, difficulty, play_time, game_type, 
        min_players, max_players,
        game_mechanics(mechanic:mechanics(name))
      `)
      .eq("id", game_id)
      .single();

    if (sourceError || !sourceGame) {
      return new Response(
        JSON.stringify({ error: "Game not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract mechanics names
    const sourceMechanics = (sourceGame.game_mechanics || [])
      .map((gm: any) => gm.mechanic?.name)
      .filter(Boolean);

    // Fetch all other games in the library
    const { data: libraryGames, error: libraryError } = await supabase
      .from("games")
      .select(`
        id, title, description, difficulty, play_time, game_type, 
        min_players, max_players, slug, image_url,
        game_mechanics(mechanic:mechanics(name))
      `)
      .eq("library_id", library_id)
      .neq("id", game_id)
      .eq("is_expansion", false)
      .limit(100);

    if (libraryError) {
      throw libraryError;
    }

    if (!libraryGames || libraryGames.length === 0) {
      return new Response(
        JSON.stringify({ recommendations: [], message: "No other games in library" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare game data for AI
    const gamesForAI = libraryGames.map((g: any) => ({
      id: g.id,
      title: g.title,
      difficulty: g.difficulty,
      play_time: g.play_time,
      game_type: g.game_type,
      min_players: g.min_players,
      max_players: g.max_players,
      mechanics: (g.game_mechanics || []).map((gm: any) => gm.mechanic?.name).filter(Boolean),
    }));

    // Build prompt for AI
    const systemPrompt = `You are a board game recommendation expert. Given a source game and a list of available games, recommend the most similar games based on:
- Game mechanics overlap
- Similar player counts
- Similar play time
- Similar difficulty/complexity
- Similar game type/category

Return ONLY a JSON array of game IDs, ordered by relevance (most similar first). Include a brief reason for each recommendation.`;

    const userPrompt = `Source game to find recommendations for:
Title: ${sourceGame.title}
Type: ${sourceGame.game_type || "Unknown"}
Difficulty: ${sourceGame.difficulty || "Unknown"}
Play Time: ${sourceGame.play_time || "Unknown"}
Players: ${sourceGame.min_players || 1}-${sourceGame.max_players || 4}
Mechanics: ${sourceMechanics.join(", ") || "None listed"}

Available games in the library:
${JSON.stringify(gamesForAI, null, 2)}

Return the top ${limit} most similar games as a JSON array with format:
[{"id": "game-uuid", "reason": "brief explanation"}]`;

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1000,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error(`AI request failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Empty AI response");
    }

    // Parse AI response - extract JSON array from response
    let recommendations: { id: string; reason: string }[] = [];
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Fallback: return games sorted by mechanic overlap
      recommendations = gamesForAI
        .map((g: any) => ({
          id: g.id,
          reason: "Similar game in your collection",
          score: g.mechanics.filter((m: string) => sourceMechanics.includes(m)).length,
        }))
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, limit)
        .map(({ id, reason }: any) => ({ id, reason }));
    }

    // Enrich recommendations with full game data
    const recommendedIds = recommendations.map((r) => r.id);
    const enrichedRecommendations = recommendedIds
      .map((id) => {
        const game = libraryGames.find((g: any) => g.id === id);
        const rec = recommendations.find((r) => r.id === id);
        if (!game) return null;
        return {
          id: game.id,
          title: game.title,
          slug: game.slug,
          image_url: game.image_url,
          difficulty: game.difficulty,
          play_time: game.play_time,
          min_players: game.min_players,
          max_players: game.max_players,
          reason: rec?.reason || "Similar game",
        };
      })
      .filter(Boolean);

    return new Response(
      JSON.stringify({ recommendations: enrichedRecommendations }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Recommendations error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to get recommendations" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
