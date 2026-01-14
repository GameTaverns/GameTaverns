import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SessionPlayer {
  id: string;
  player_name: string;
  score: number | null;
  is_winner: boolean;
  is_first_play: boolean;
}

export interface GameSession {
  id: string;
  game_id: string;
  played_at: string;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
  players: SessionPlayer[];
}

export interface CreateSessionInput {
  game_id: string;
  played_at: string;
  duration_minutes?: number | null;
  notes?: string | null;
  players: Omit<SessionPlayer, "id">[];
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

      // Fetch players for all sessions
      const sessionIds = sessionsData.map((s) => s.id);
      const { data: playersData, error: playersError } = await supabase
        .from("game_session_players")
        .select("*")
        .in("session_id", sessionIds);

      if (playersError) throw playersError;

      // Combine sessions with their players
      return sessionsData.map((session) => ({
        ...session,
        players: (playersData || [])
          .filter((p) => p.session_id === session.id)
          .map((p) => ({
            id: p.id,
            player_name: p.player_name,
            score: p.score,
            is_winner: p.is_winner,
            is_first_play: p.is_first_play,
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

      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-sessions", gameId] });
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
