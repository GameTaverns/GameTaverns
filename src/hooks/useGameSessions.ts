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
  linked_user_id?: string | null;
  tag_status?: string | null;
  // Joined from user_profiles when linked
  linked_display_name?: string | null;
  linked_username?: string | null;
  linked_avatar_url?: string | null;
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
  players: (Omit<SessionPlayer, "id" | "linked_display_name" | "linked_username" | "linked_avatar_url"> & {
    linked_user_id?: string | null;
    tag_status?: string;
  })[];
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

      // Fetch linked user profiles for tagged players
      const linkedUserIds = [...new Set(
        (playersResult.data || [])
          .map((p: any) => p.linked_user_id)
          .filter(Boolean)
      )];
      let linkedProfiles: Record<string, { display_name: string | null; username: string | null; avatar_url: string | null }> = {};
      if (linkedUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("user_id, display_name, username, avatar_url")
          .in("user_id", linkedUserIds as string[]);
        linkedProfiles = (profiles || []).reduce((acc, p) => {
          acc[p.user_id] = { display_name: p.display_name, username: p.username, avatar_url: p.avatar_url };
          return acc;
        }, {} as typeof linkedProfiles);
      }

      // Combine sessions with their players and expansions
      return sessionsData.map((session) => ({
        ...session,
        players: (playersResult.data || [])
          .filter((p: any) => p.session_id === session.id)
          .map((p: any) => ({
            id: p.id,
            player_name: p.player_name,
            score: p.score,
            is_winner: p.is_winner,
            is_first_play: p.is_first_play,
            color: p.color ?? null,
            linked_user_id: p.linked_user_id ?? null,
            tag_status: p.tag_status ?? "none",
            linked_display_name: p.linked_user_id ? (linkedProfiles[p.linked_user_id]?.display_name ?? null) : null,
            linked_username: p.linked_user_id ? (linkedProfiles[p.linked_user_id]?.username ?? null) : null,
            linked_avatar_url: p.linked_user_id ? (linkedProfiles[p.linked_user_id]?.avatar_url ?? null) : null,
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

      // Get current user for tagging
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const currentUserId = authSession?.user?.id;

      // Create players if any
      let createdPlayers: any[] = [];
      if (input.players.length > 0) {
        const { data: insertedPlayers, error: playersError } = await supabase
          .from("game_session_players")
          .insert(
            input.players.map((p) => ({
              session_id: session.id,
              player_name: p.player_name,
              score: p.score,
              is_winner: p.is_winner,
              is_first_play: p.is_first_play,
              linked_user_id: (p as any).linked_user_id ?? null,
              tag_status: (p as any).tag_status ?? "none",
            }))
          )
          .select();

        if (playersError) throw playersError;
        createdPlayers = insertedPlayers || [];
      }

      // Create tag requests for linked players
      if (currentUserId) {
        const taggedPlayers = input.players
          .map((p, i) => ({ p, playerRow: createdPlayers[i] }))
          .filter(({ p }) => (p as any).linked_user_id && (p as any).tag_status === "pending");

        // Fetch game title for the notification
        const { data: gameData } = await supabase
          .from("games")
          .select("title")
          .eq("id", input.game_id)
          .maybeSingle();

        if (taggedPlayers.length > 0) {
          await (supabase as any)
            .from("session_tag_requests")
            .insert(
              taggedPlayers
                .filter(({ playerRow }) => playerRow?.id)
                .map(({ p, playerRow }) => ({
                  session_player_id: playerRow.id,
                  tagged_user_id: (p as any).linked_user_id,
                  tagged_by_user_id: currentUserId,
                  game_id: input.game_id,
                  game_title: gameData?.title ?? null,
                  session_date: input.played_at,
                }))
            );
        }
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
      queryClient.invalidateQueries({ queryKey: ["play-stats"] });
      queryClient.invalidateQueries({ queryKey: ["library-analytics-summary"] });
      queryClient.invalidateQueries({ queryKey: ["library-analytics-trends"] });
      queryClient.invalidateQueries({ queryKey: ["library-analytics-top-games"] });
      queryClient.invalidateQueries({ queryKey: ["session-tag-requests"] });
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
