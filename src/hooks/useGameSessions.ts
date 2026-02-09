import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useToast } from "@/hooks/use-toast";

export interface SessionPlayer {
  id: string;
  player_name: string;
  score: number | null;
  is_winner: boolean;
  is_first_play: boolean;
  color: string | null;
}

export interface SessionExpansion {
  id: string;
  expansion_id: string;
  title: string;
  image_url: string | null;
}

export interface GameSession {
  id: string;
  game_id: string;
  played_at: string;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
  players: SessionPlayer[];
  expansions: SessionExpansion[];
}

export interface CreateSessionInput {
  game_id: string;
  played_at: string;
  duration_minutes?: number | null;
  notes?: string | null;
  players: Omit<SessionPlayer, "id">[];
  expansion_ids?: string[];
}

export function useGameSessions(gameId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: sessions = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["game-sessions", gameId],
    queryFn: async () => {
      // Fetch sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("game_id", gameId)
        .order("played_at", { ascending: false });

      if (sessionsError) throw sessionsError;
      if (!sessionsData || sessionsData.length === 0) return [];

      const sessionIds = sessionsData.map((s) => s.id);

      // Fetch players and expansions in parallel
      const [playersResult, expansionsResult] = await Promise.all([
        supabase
          .from("game_session_players")
          .select("*")
          .in("session_id", sessionIds),
        supabase
          .from("game_session_expansions")
          .select("id, session_id, expansion_id")
          .in("session_id", sessionIds),
      ]);

      if (playersResult.error) throw playersResult.error;
      if (expansionsResult.error) throw expansionsResult.error;

      // Fetch expansion game details if any
      const expansionIds = [...new Set((expansionsResult.data || []).map((e) => e.expansion_id))];
      let expansionDetails: Record<string, { title: string; image_url: string | null }> = {};
      
      if (expansionIds.length > 0) {
        const { data: games } = await supabase
          .from("games")
          .select("id, title, image_url")
          .in("id", expansionIds);
        
        expansionDetails = (games || []).reduce((acc, g) => {
          acc[g.id] = { title: g.title, image_url: g.image_url };
          return acc;
        }, {} as Record<string, { title: string; image_url: string | null }>);
      }

      // Combine sessions with their players and expansions
      return sessionsData.map((session) => ({
        ...session,
        players: (playersResult.data || [])
          .filter((p) => p.session_id === session.id)
          .map((p) => ({
            id: p.id,
            player_name: p.player_name,
            score: p.score,
            is_winner: p.is_winner,
            is_first_play: p.is_first_play,
            color: (p as any).color ?? null,
          })),
        expansions: (expansionsResult.data || [])
          .filter((e) => e.session_id === session.id)
          .map((e) => ({
            id: e.id,
            expansion_id: e.expansion_id,
            title: expansionDetails[e.expansion_id]?.title || "Unknown",
            image_url: expansionDetails[e.expansion_id]?.image_url || null,
          })),
      })) as GameSession[];
    },
    enabled: !!gameId,
  });

  const createSession = useMutation({
    mutationFn: async (input: CreateSessionInput) => {
      // Create the session
      const { data: session, error: sessionError } = await supabase
        .from("game_sessions")
        .insert({
          game_id: input.game_id,
          played_at: input.played_at,
          duration_minutes: input.duration_minutes,
          notes: input.notes,
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Create players if any
      if (input.players.length > 0) {
        const { error: playersError } = await supabase
          .from("game_session_players")
          .insert(
            input.players.map((p) => ({
              session_id: session.id,
              player_name: p.player_name,
              score: p.score,
              is_winner: p.is_winner,
              is_first_play: p.is_first_play,
            }))
          );

        if (playersError) throw playersError;
      }

      // Create expansion records if any
      if (input.expansion_ids && input.expansion_ids.length > 0) {
        const { error: expansionsError } = await supabase
          .from("game_session_expansions")
          .insert(
            input.expansion_ids.map((expId) => ({
              session_id: session.id,
              expansion_id: expId,
            }))
          );

        if (expansionsError) throw expansionsError;
      }
      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-sessions", gameId] });
      // Also invalidate play stats and analytics caches
      queryClient.invalidateQueries({ queryKey: ["play-stats"] });
      queryClient.invalidateQueries({ queryKey: ["library-analytics-summary"] });
      queryClient.invalidateQueries({ queryKey: ["library-analytics-trends"] });
      queryClient.invalidateQueries({ queryKey: ["library-analytics-top-games"] });
      toast({
        title: "Play session logged!",
        description: "The game session has been recorded.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to log session",
        variant: "destructive",
      });
    },
  });

  const deleteSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from("game_sessions")
        .delete()
        .eq("id", sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-sessions", gameId] });
      // Also invalidate play stats and analytics caches
      queryClient.invalidateQueries({ queryKey: ["play-stats"] });
      queryClient.invalidateQueries({ queryKey: ["library-analytics-summary"] });
      queryClient.invalidateQueries({ queryKey: ["library-analytics-trends"] });
      queryClient.invalidateQueries({ queryKey: ["library-analytics-top-games"] });
      toast({
        title: "Session deleted",
        description: "The play session has been removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete session",
        variant: "destructive",
      });
    },
  });

  return {
    sessions,
    isLoading,
    error,
    createSession,
    deleteSession,
    totalPlays: sessions.length,
  };
}
