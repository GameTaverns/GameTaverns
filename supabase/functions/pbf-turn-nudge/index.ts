import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find all active PBF games with turn time limits that are overdue
    const { data: overdueGames, error: fetchError } = await supabase
      .from("pbf_games")
      .select(`
        id, game_title, thread_id, current_player_index, 
        turn_time_limit_hours, turn_started_at
      `)
      .eq("status", "active")
      .not("turn_time_limit_hours", "is", null);

    if (fetchError) throw fetchError;

    let nudgeCount = 0;

    for (const game of overdueGames || []) {
      const turnStart = new Date(game.turn_started_at);
      const now = new Date();
      const hoursElapsed = (now.getTime() - turnStart.getTime()) / (1000 * 60 * 60);

      // Only nudge if past the time limit
      if (hoursElapsed < game.turn_time_limit_hours) continue;

      // Don't nudge more than once per 12 hours (check if we already nudged recently)
      const hoursSinceLimit = hoursElapsed - game.turn_time_limit_hours;
      // Only nudge at the limit boundary, then every 12h after
      if (hoursSinceLimit > 1 && (hoursSinceLimit % 12) > 1) continue;

      // Get the current player
      const { data: currentPlayer } = await supabase
        .from("pbf_game_players")
        .select("user_id, display_name")
        .eq("pbf_game_id", game.id)
        .eq("player_order", game.current_player_index)
        .eq("status", "active")
        .single();

      if (!currentPlayer) continue;

      // Check if we already sent a nudge notification in the last 12 hours
      const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
      const { count: recentNudges } = await supabase
        .from("notification_log")
        .select("*", { count: "exact", head: true })
        .eq("user_id", currentPlayer.user_id)
        .eq("notification_type", "pbf_turn_nudge")
        .gte("sent_at", twelveHoursAgo);

      if ((recentNudges || 0) > 0) continue;

      // Send nudge notification
      const hoursOverdue = Math.floor(hoursElapsed - game.turn_time_limit_hours);
      await supabase.from("notification_log").insert({
        user_id: currentPlayer.user_id,
        notification_type: "pbf_turn_nudge",
        channel: "in_app",
        title: `⏰ Your turn is overdue in ${game.game_title}!`,
        body: `You've had ${hoursOverdue}h past the ${game.turn_time_limit_hours}h limit. Head to the thread to make your move!`,
        metadata: { thread_id: game.thread_id, pbf_game_id: game.id },
        sent_at: now.toISOString(),
      });

      nudgeCount++;
      console.log(`[pbf-turn-nudge] Nudged player ${currentPlayer.user_id} for game ${game.id}`);
    }

    return new Response(
      JSON.stringify({ success: true, nudged: nudgeCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[pbf-turn-nudge] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
