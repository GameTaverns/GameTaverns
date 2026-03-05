import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

export interface PbfGame {
  id: string;
  thread_id: string;
  game_id: string | null;
  game_title: string;
  game_image_url: string | null;
  status: "active" | "paused" | "completed" | "abandoned";
  current_player_index: number;
  turn_time_limit_hours: number | null;
  turn_started_at: string;
  winner_user_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PbfPlayer {
  id: string;
  pbf_game_id: string;
  user_id: string;
  player_order: number;
  display_name: string | null;
  status: "active" | "eliminated" | "withdrew";
  joined_at: string;
  profile?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export interface PbfMove {
  id: string;
  pbf_game_id: string;
  player_id: string;
  move_number: number;
  move_text: string;
  image_url: string | null;
  created_at: string;
  player?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

// Get PBF game by thread ID
export function usePbfGame(threadId: string | undefined) {
  return useQuery({
    queryKey: ["pbf-game", threadId],
    queryFn: async () => {
      if (!threadId) return null;
      const { data, error } = await supabase
        .from("pbf_games")
        .select("*")
        .eq("thread_id", threadId)
        .maybeSingle();
      if (error) throw error;
      return data as PbfGame | null;
    },
    enabled: !!threadId,
  });
}

// Get PBF players
export function usePbfPlayers(pbfGameId: string | undefined) {
  return useQuery({
    queryKey: ["pbf-players", pbfGameId],
    queryFn: async () => {
      if (!pbfGameId) return [];
      const { data, error } = await supabase
        .from("pbf_game_players")
        .select("*")
        .eq("pbf_game_id", pbfGameId)
        .order("player_order");
      if (error) throw error;

      // Fetch profiles
      const userIds = data.map((p: any) => p.user_id);
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map(
        (profiles || []).map((p: any) => [p.user_id, p])
      );

      return data.map((p: any) => ({
        ...p,
        profile: profileMap.get(p.user_id) || null,
      })) as PbfPlayer[];
    },
    enabled: !!pbfGameId,
  });
}

// Get PBF moves
export function usePbfMoves(pbfGameId: string | undefined) {
  return useQuery({
    queryKey: ["pbf-moves", pbfGameId],
    queryFn: async () => {
      if (!pbfGameId) return [];
      const { data, error } = await supabase
        .from("pbf_moves")
        .select("*")
        .eq("pbf_game_id", pbfGameId)
        .order("move_number", { ascending: true });
      if (error) throw error;

      // Fetch profiles
      const playerIds = [...new Set(data.map((m: any) => m.player_id))];
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", playerIds);

      const profileMap = new Map(
        (profiles || []).map((p: any) => [p.user_id, p])
      );

      return data.map((m: any) => ({
        ...m,
        player: profileMap.get(m.player_id) || null,
      })) as PbfMove[];
    },
    enabled: !!pbfGameId,
  });
}

// Realtime subscription for moves
export function usePbfMovesRealtime(pbfGameId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!pbfGameId) return;

    const channel = supabase
      .channel(`pbf-moves-${pbfGameId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pbf_moves",
          filter: `pbf_game_id=eq.${pbfGameId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pbf-moves", pbfGameId] });
          queryClient.invalidateQueries({ queryKey: ["pbf-game"] });
        }
      )
      .subscribe();

    // Also listen for game status changes
    const gameChannel = supabase
      .channel(`pbf-game-${pbfGameId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pbf_games",
          filter: `id=eq.${pbfGameId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pbf-game"] });
          queryClient.invalidateQueries({ queryKey: ["pbf-players", pbfGameId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(gameChannel);
    };
  }, [pbfGameId, queryClient]);
}

// Create PBF game (thread + pbf_games + players)
export function useCreatePbfGame() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      categoryId,
      gameTitle,
      gameImageUrl,
      gameId,
      playerUserIds,
      turnTimeLimitHours,
      description,
    }: {
      categoryId: string;
      gameTitle: string;
      gameImageUrl?: string;
      gameId?: string;
      playerUserIds: string[];
      turnTimeLimitHours?: number;
      description?: string;
    }) => {
      if (!user) throw new Error("Must be logged in");

      // 1. Create the forum thread
      const threadContent = description || `<p>A new Play-by-Forum game of <strong>${gameTitle}</strong> has started! Players will take turns posting their moves here.</p>`;

      const { data: thread, error: threadError } = await supabase
        .from("forum_threads")
        .insert({
          category_id: categoryId,
          title: `🎲 PBF: ${gameTitle}`,
          content: threadContent,
          author_id: user.id,
          thread_type: "play_by_forum",
        })
        .select()
        .single();

      if (threadError) throw threadError;

      // 2. Create the PBF game
      const { data: pbfGame, error: gameError } = await supabase
        .from("pbf_games")
        .insert({
          thread_id: thread.id,
          game_id: gameId || null,
          game_title: gameTitle,
          game_image_url: gameImageUrl || null,
          turn_time_limit_hours: turnTimeLimitHours || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (gameError) throw gameError;

      // 3. Add players (creator first, then others)
      const allPlayerIds = [user.id, ...playerUserIds.filter((id) => id !== user.id)];
      const playerInserts = allPlayerIds.map((userId, index) => ({
        pbf_game_id: pbfGame.id,
        user_id: userId,
        player_order: index,
      }));

      const { error: playersError } = await supabase
        .from("pbf_game_players")
        .insert(playerInserts);

      if (playersError) throw playersError;

      return { thread, pbfGame };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-threads"] });
      toast.success("Play-by-Forum game created!");
    },
    onError: (error) => {
      toast.error("Failed to create game: " + error.message);
    },
  });
}

// Submit a move
export function useSubmitMove() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      pbfGameId,
      moveText,
      imageUrl,
    }: {
      pbfGameId: string;
      moveText: string;
      imageUrl?: string;
    }) => {
      if (!user) throw new Error("Must be logged in");

      // Get current move count
      const { count } = await supabase
        .from("pbf_moves")
        .select("*", { count: "exact", head: true })
        .eq("pbf_game_id", pbfGameId);

      const moveNumber = (count || 0) + 1;

      const { data, error } = await supabase
        .from("pbf_moves")
        .insert({
          pbf_game_id: pbfGameId,
          player_id: user.id,
          move_number: moveNumber,
          move_text: moveText,
          image_url: imageUrl || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pbf-moves", data.pbf_game_id] });
      queryClient.invalidateQueries({ queryKey: ["pbf-game"] });
      toast.success("Move submitted!");
    },
    onError: (error) => {
      toast.error("Failed to submit move: " + error.message);
    },
  });
}

// Update game status (with optional winner for ELO)
export function useUpdatePbfStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pbfGameId,
      status,
      winnerUserId,
    }: {
      pbfGameId: string;
      status: "active" | "paused" | "completed" | "abandoned";
      winnerUserId?: string;
    }) => {
      const updateData: Record<string, any> = { status };
      if (winnerUserId) updateData.winner_user_id = winnerUserId;

      const { data, error } = await supabase
        .from("pbf_games")
        .update(updateData)
        .eq("id", pbfGameId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pbf-game"] });
      queryClient.invalidateQueries({ queryKey: ["pbf-players"] });
      toast.success(`Game ${data.status === "completed" ? "completed" : data.status === "paused" ? "paused" : data.status === "active" ? "resumed" : "ended"}!`);
    },
  });
}
