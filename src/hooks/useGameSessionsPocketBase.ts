/**
 * PocketBase Game Sessions Hook
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pb } from '@/integrations/pocketbase/client';
import { Collections, type GameSession as PBGameSession, type SessionPlayer as PBSessionPlayer } from '@/integrations/pocketbase/types';
import { useToast } from '@/hooks/use-toast';

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
  players: Omit<SessionPlayer, 'id'>[];
}

export function useGameSessions(gameId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: sessions = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['game-sessions', gameId],
    queryFn: async () => {
      // Fetch sessions for this game
      const sessionsData = await pb.collection(Collections.GAME_SESSIONS).getFullList<PBGameSession>({
        filter: `game = "${gameId}"`,
        sort: '-played_at',
      });

      if (sessionsData.length === 0) return [];

      // Fetch players for all sessions
      const sessionIds = sessionsData.map(s => s.id);
      const playersData = await pb.collection(Collections.SESSION_PLAYERS).getFullList<PBSessionPlayer>({
        filter: sessionIds.map(id => `session = "${id}"`).join(' || '),
      });

      // Combine sessions with their players
      return sessionsData.map((session) => ({
        id: session.id,
        game_id: session.game,
        played_at: session.played_at,
        duration_minutes: session.duration_minutes || null,
        notes: session.notes || null,
        created_at: session.created,
        players: playersData
          .filter((p) => p.session === session.id)
          .map((p) => ({
            id: p.id,
            player_name: p.player_name,
            score: p.score || null,
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
      const session = await pb.collection(Collections.GAME_SESSIONS).create({
        game: input.game_id,
        played_at: input.played_at,
        duration_minutes: input.duration_minutes,
        notes: input.notes,
      });

      // Create players if any
      if (input.players.length > 0) {
        await Promise.all(
          input.players.map((p) =>
            pb.collection(Collections.SESSION_PLAYERS).create({
              session: session.id,
              player_name: p.player_name,
              score: p.score,
              is_winner: p.is_winner,
              is_first_play: p.is_first_play,
            })
          )
        );
      }

      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game-sessions', gameId] });
      toast({
        title: 'Play session logged!',
        description: 'The game session has been recorded.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to log session',
        variant: 'destructive',
      });
    },
  });

  const deleteSession = useMutation({
    mutationFn: async (sessionId: string) => {
      await pb.collection(Collections.GAME_SESSIONS).delete(sessionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game-sessions', gameId] });
      toast({
        title: 'Session deleted',
        description: 'The play session has been removed.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete session',
        variant: 'destructive',
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
