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
  // Community/forum metrics
  threads_created: number;
  replies_created: number;
  thread_replies_received: number;
  libraries_joined: number;
  library_forums_active: number;
  // Shelf of Shame metrics
  shame_games_played: number;
  zero_shame: number;
}

const handler = async (req: Request): Promise<Response> => {
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
      threads_created: 0,
      replies_created: 0,
      thread_replies_received: 0,
      libraries_joined: 0,
      library_forums_active: 0,
      shame_games_played: 0,
      zero_shame: 0,
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
      .eq("library_id", libraryId)
      .neq("user_id", user.id);
    
    progress.followers_gained = (followersCount || 0) + (membersCount || 0);

    // Wishlist votes (votes cast for games in this library)
    const { count: wishlistCount } = await supabaseAdmin
      .from("game_wishlist")
      .select("*, games!inner(library_id)", { count: "exact", head: true })
      .eq("games.library_id", libraryId);
    progress.wishlist_votes = wishlistCount || 0;

    // Ratings given (ratings for games in this library)
    const { count: ratingsCount } = await supabaseAdmin
      .from("game_ratings")
      .select("*, games!inner(library_id)", { count: "exact", head: true })
      .eq("games.library_id", libraryId);
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

    // === Community/Forum Metrics ===
    
    // Threads created by user
    const { count: threadsCount } = await supabaseAdmin
      .from("forum_threads")
      .select("*", { count: "exact", head: true })
      .eq("author_id", user.id);
    progress.threads_created = threadsCount || 0;

    // Replies created by user
    const { count: repliesCount } = await supabaseAdmin
      .from("forum_replies")
      .select("*", { count: "exact", head: true })
      .eq("author_id", user.id);
    progress.replies_created = repliesCount || 0;

    // Max replies received on any single thread by user
    const { data: userThreads } = await supabaseAdmin
      .from("forum_threads")
      .select("reply_count")
      .eq("author_id", user.id)
      .order("reply_count", { ascending: false })
      .limit(1);
    progress.thread_replies_received = userThreads?.[0]?.reply_count || 0;

    // Libraries joined (as member, not owner)
    const { count: librariesJoined } = await supabaseAdmin
      .from("library_members")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    progress.libraries_joined = librariesJoined || 0;

    // Unique library forums user has posted in
    const { data: forumActivity } = await supabaseAdmin
      .from("forum_threads")
      .select("category:forum_categories(library_id)")
      .eq("author_id", user.id);
    const { data: replyActivity } = await supabaseAdmin
      .from("forum_replies")
      .select("thread:forum_threads(category:forum_categories(library_id))")
      .eq("author_id", user.id);
    
    const libraryForumsSet = new Set<string>();
    forumActivity?.forEach((t: any) => {
      if (t.category?.library_id) libraryForumsSet.add(t.category.library_id);
    });
    replyActivity?.forEach((r: any) => {
      if (r.thread?.category?.library_id) libraryForumsSet.add(r.thread.category.library_id);
    });
    progress.library_forums_active = libraryForumsSet.size;

    // === Shelf of Shame Metrics ===
    
    // Count games that were previously is_unplayed=true but now have at least one session
    // These are games the user "rescued" from the Shelf of Shame
    const { data: shameGames } = await supabaseAdmin
      .from("games")
      .select("id")
      .eq("library_id", libraryId)
      .eq("is_expansion", false)
      .eq("is_unplayed", false);
    
    // Count those that have sessions (played at least once)
    let shamePlayedCount = 0;
    if (shameGames && shameGames.length > 0) {
      // Check which games have sessions — these were "rescued"
      const gameIds = shameGames.map(g => g.id);
      const BATCH = 50;
      for (let i = 0; i < gameIds.length; i += BATCH) {
        const batch = gameIds.slice(i, i + BATCH);
        const { count } = await supabaseAdmin
          .from("game_sessions")
          .select("game_id", { count: "exact", head: true })
          .in("game_id", batch);
        shamePlayedCount += count || 0;
      }
    }
    progress.shame_games_played = shamePlayedCount;

    // Zero shame: no unplayed games at all
    const { count: unplayedCount } = await supabaseAdmin
      .from("games")
      .select("*", { count: "exact", head: true })
      .eq("library_id", libraryId)
      .eq("is_expansion", false)
      .eq("is_unplayed", true);
    progress.zero_shame = (unplayedCount === 0 && progress.games_owned > 0) ? 1 : 0;

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
};

export default handler;

if (import.meta.main) {
  Deno.serve(handler);
}
