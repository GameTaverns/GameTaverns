import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Daily challenge prompts - rotate through these
const CHALLENGES = [
  {
    title: "🎲 Daily Challenge: What's your go-to 2-player game?",
    content: "<p>Today's challenge: Tell us your favorite 2-player game and why! Bonus points if you explain your winning strategy. 🏆</p>",
  },
  {
    title: "🎲 Daily Challenge: Unpopular Board Game Opinions",
    content: "<p>Share your most unpopular board game opinion! No judgment here — this is a safe space for hot takes. 🔥</p>",
  },
  {
    title: "🎲 Daily Challenge: If you could only keep 5 games...",
    content: "<p>Your shelf is shrinking! If you could only keep 5 games from your collection, which would they be and why?</p>",
  },
  {
    title: "🎲 Daily Challenge: Teach me a game in 3 sentences",
    content: "<p>Pick any game and explain how to play it in exactly 3 sentences. Can you do it? 📝</p>",
  },
  {
    title: "🎲 Daily Challenge: Best game you played this week?",
    content: "<p>What's the best game you played this week? Tell us about the session — who won, any memorable moments?</p>",
  },
  {
    title: "🎲 Daily Challenge: Game Night Snack Tier List",
    content: "<p>Rank your game night snacks! What's S-tier, and what should be banned from the table? 🍕🧀</p>",
  },
  {
    title: "🎲 Daily Challenge: Hidden Gem Recommendation",
    content: "<p>Recommend a board game that you think is criminally underrated. What makes it special? 💎</p>",
  },
];

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get today's challenge (rotate by day of year)
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
    );
    const challenge = CHALLENGES[dayOfYear % CHALLENGES.length];

    // Find all "play-by-forum" subcategories across libraries and clubs
    const { data: pbfCategories, error: catError } = await supabase
      .from("forum_categories")
      .select("id, library_id, club_id")
      .eq("slug", "play-by-forum")
      .eq("is_archived", false);

    if (catError) throw catError;

    if (!pbfCategories || pbfCategories.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No PBF categories found", posted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let postedCount = 0;

    for (const category of pbfCategories) {
      // Check if we already posted a daily challenge today in this category
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count: existingToday } = await supabase
        .from("forum_threads")
        .select("*", { count: "exact", head: true })
        .eq("category_id", category.id)
        .eq("thread_type", "discussion")
        .like("title", "🎲 Daily Challenge:%")
        .gte("created_at", todayStart.toISOString());

      if ((existingToday || 0) > 0) continue;

      // We need a system user to post as — use the library/club owner
      let authorId: string | null = null;

      if (category.library_id) {
        const { data: lib } = await supabase
          .from("libraries")
          .select("owner_id")
          .eq("id", category.library_id)
          .single();
        authorId = lib?.owner_id || null;
      } else if (category.club_id) {
        const { data: club } = await supabase
          .from("clubs")
          .select("owner_id")
          .eq("id", category.club_id)
          .single();
        authorId = club?.owner_id || null;
      }

      if (!authorId) continue;

      // Create the daily challenge thread
      const { error: threadError } = await supabase
        .from("forum_threads")
        .insert({
          category_id: category.id,
          title: challenge.title,
          content: challenge.content,
          author_id: authorId,
          thread_type: "discussion",
        });

      if (threadError) {
        console.error(`[pbf-daily-challenge] Failed to post in category ${category.id}:`, threadError);
        continue;
      }

      postedCount++;
      console.log(`[pbf-daily-challenge] Posted in category ${category.id}`);
    }

    return new Response(
      JSON.stringify({ success: true, posted: postedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[pbf-daily-challenge] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
