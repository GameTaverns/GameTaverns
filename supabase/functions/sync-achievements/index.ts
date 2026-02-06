import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Achievement {
  id: string;
  requirement_type: string;
  requirement_value: number;
}

interface UserProgress {
  games_owned: number;
  sessions_logged: number;
  loans_completed: number;
  followers_gained: number;
  wishlist_votes: number;
  ratings_given: number;
  unique_game_types: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Client with user's auth for getting their info
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's library
    // Prefer owned library; if user is only a member, fall back to the first joined library.
    const { data: ownedLibrary } = await supabaseAdmin
      .from("libraries")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    let libraryId: string | null = ownedLibrary?.id ?? null;

    if (!libraryId) {
      const { data: membership } = await supabaseAdmin
        .from("library_members")
        .select("library_id")
        .eq("user_id", user.id)
        .maybeSingle();
      libraryId = membership?.library_id ?? null;
    }

    if (!libraryId) {
      return new Response(JSON.stringify({ error: "No library found", awarded: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate user's current progress
    const progress: UserProgress = {
      games_owned: 0,
      sessions_logged: 0,
      loans_completed: 0,
      followers_gained: 0,
      wishlist_votes: 0,
      ratings_given: 0,
      unique_game_types: 0,
    };

    // Games owned (excluding expansions)
    const { count: gamesCount } = await supabaseAdmin
      .from("games")
      .select("*", { count: "exact", head: true })
      .eq("library_id", libraryId)
      .eq("is_expansion", false);
    progress.games_owned = gamesCount || 0;

    // Sessions logged
    const { count: sessionsCount } = await supabaseAdmin
      .from("game_sessions")
      .select("*, games!inner(library_id)", { count: "exact", head: true })
      .eq("games.library_id", libraryId);
    progress.sessions_logged = sessionsCount || 0;

    // Loans completed (as lender)
    const { count: loansCount } = await supabaseAdmin
      .from("game_loans")
      .select("*", { count: "exact", head: true })
      .eq("lender_user_id", user.id)
      .eq("status", "returned");
    progress.loans_completed = loansCount || 0;

    // Followers/members gained (combine library_followers and library_members, excluding owner)
    const { count: followersCount } = await supabaseAdmin
      .from("library_followers")
      .select("*", { count: "exact", head: true })
      .eq("library_id", libraryId);
    
    // Also count library members (excluding the owner themselves)
    const { count: membersCount } = await supabaseAdmin
      .from("library_members")
      .select("*", { count: "exact", head: true })
      .eq("library_id", library.id)
      .neq("user_id", user.id);
    
    progress.followers_gained = (followersCount || 0) + (membersCount || 0);

    // Wishlist votes (votes the user has cast)
    const { count: wishlistCount } = await supabaseAdmin
      .from("game_wishlist")
      .select("*, games!inner(library_id)", { count: "exact", head: true })
      .eq("games.library_id", library.id);
    progress.wishlist_votes = wishlistCount || 0;

    // Ratings given (by user's guest identifier or games in their library)
    const { count: ratingsCount } = await supabaseAdmin
      .from("game_ratings")
      .select("*, games!inner(library_id)", { count: "exact", head: true })
      .eq("games.library_id", library.id);
    progress.ratings_given = ratingsCount || 0;

    // Unique game types
    const { data: gameTypes } = await supabaseAdmin
      .from("games")
      .select("game_type")
      .eq("library_id", libraryId)
      .eq("is_expansion", false)
      .not("game_type", "is", null);
    const uniqueTypes = new Set(gameTypes?.map(g => g.game_type) || []);
    progress.unique_game_types = uniqueTypes.size;

    // Get all achievements
    const { data: achievements } = await supabaseAdmin
      .from("achievements")
      .select("id, requirement_type, requirement_value");

    // Get already earned achievements
    const { data: earnedAchievements } = await supabaseAdmin
      .from("user_achievements")
      .select("achievement_id")
      .eq("user_id", user.id);
    
    const earnedIds = new Set(earnedAchievements?.map(a => a.achievement_id) || []);

    // Check which achievements should be awarded
    const toAward: string[] = [];
    
    for (const achievement of (achievements || [])) {
      if (earnedIds.has(achievement.id)) continue;
      
      const currentValue = progress[achievement.requirement_type as keyof UserProgress] || 0;
      if (currentValue >= achievement.requirement_value) {
        toAward.push(achievement.id);
      }
    }

    // Award new achievements
    const awarded: string[] = [];
    for (const achievementId of toAward) {
      const { error: insertError } = await supabaseAdmin
        .from("user_achievements")
        .insert({
          user_id: user.id,
          achievement_id: achievementId,
          progress: progress[(achievements?.find(a => a.id === achievementId)?.requirement_type || "games_owned") as keyof UserProgress] || 0,
          notified: false,
        });
      
      if (!insertError) {
        awarded.push(achievementId);
      }
    }

    // Get names of awarded achievements for response
    let awardedNames: string[] = [];
    if (awarded.length > 0) {
      const { data: awardedAchievements } = await supabaseAdmin
        .from("achievements")
        .select("name")
        .in("id", awarded);
      awardedNames = awardedAchievements?.map(a => a.name) || [];
    }

    return new Response(
      JSON.stringify({
        success: true,
        progress,
        newAchievements: awarded.length,
        awarded: awardedNames,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error syncing achievements:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
