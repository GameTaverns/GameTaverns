import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useToast } from "@/hooks/use-toast";

const db = supabase as any;

export type TournamentFormat = "single_elimination" | "double_elimination" | "round_robin" | "swiss";

export interface TournamentConfig {
  id: string;
  event_id: string;
  format: TournamentFormat;
  max_rounds: number | null;
  current_round: number;
  status: "setup" | "in_progress" | "completed";
  seed_method: string;
  third_place_match: boolean;
  points_win: number;
  points_draw: number;
  points_loss: number;
  tiebreaker: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TournamentPlayer {
  id: string;
  event_id: string;
  player_name: string;
  player_user_id: string | null;
  seed: number | null;
  is_eliminated: boolean;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  tiebreaker_score: number;
  created_at: string;
}

export interface TournamentMatch {
  id: string;
  event_id: string;
  round_number: number;
  match_number: number;
  bracket_position: string | null;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  player1_score: number | null;
  player2_score: number | null;
  status: "pending" | "in_progress" | "completed" | "bye";
  scheduled_time: string | null;
  table_label: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Config ─────────────────────────────────────────────────────────────────

export function useTournamentConfig(eventId: string | undefined) {
  return useQuery({
    queryKey: ["tournament-config", eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const { data, error } = await db
        .from("event_tournament_config")
        .select("*")
        .eq("event_id", eventId)
        .maybeSingle();
      if (error) throw error;
      return data as TournamentConfig | null;
    },
    enabled: !!eventId,
  });
}

export function useUpsertTournamentConfig() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: Partial<TournamentConfig> & { event_id: string }) => {
      const { data, error } = await db
        .from("event_tournament_config")
        .upsert({
          ...input,
          updated_at: new Date().toISOString(),
        }, { onConflict: "event_id" })
        .select()
        .single();
      if (error) throw error;
      return data as TournamentConfig;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tournament-config", data.event_id] });
      toast({ title: "Tournament config saved" });
    },
    onError: (e: Error) => toast({ title: "Failed to save config", description: e.message, variant: "destructive" }),
  });
}

// ── Players ────────────────────────────────────────────────────────────────

export function useTournamentPlayers(eventId: string | undefined) {
  return useQuery({
    queryKey: ["tournament-players", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await db
        .from("event_tournament_players")
        .select("*")
        .eq("event_id", eventId)
        .order("seed", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as TournamentPlayer[];
    },
    enabled: !!eventId,
  });
}

export function useAddTournamentPlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { event_id: string; player_name: string; seed?: number; player_user_id?: string }) => {
      const { data, error } = await db
        .from("event_tournament_players")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => qc.invalidateQueries({ queryKey: ["tournament-players", data.event_id] }),
  });
}

export function useRemoveTournamentPlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ playerId, eventId }: { playerId: string; eventId: string }) => {
      const { error } = await db.from("event_tournament_players").delete().eq("id", playerId);
      if (error) throw error;
      return { eventId };
    },
    onSuccess: (data: any) => qc.invalidateQueries({ queryKey: ["tournament-players", data.eventId] }),
  });
}

// ── Matches ────────────────────────────────────────────────────────────────

export function useTournamentMatches(eventId: string | undefined) {
  return useQuery({
    queryKey: ["tournament-matches", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await db
        .from("event_tournament_matches")
        .select("*")
        .eq("event_id", eventId)
        .order("round_number", { ascending: true })
        .order("match_number", { ascending: true });
      if (error) throw error;
      return (data || []) as TournamentMatch[];
    },
    enabled: !!eventId,
  });
}

export function useCreateTournamentMatches() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ eventId, matches }: { eventId: string; matches: Omit<TournamentMatch, "id" | "created_at" | "updated_at">[] }) => {
      // Delete existing matches first
      await db.from("event_tournament_matches").delete().eq("event_id", eventId);
      
      if (matches.length === 0) return [];
      const { data, error } = await db
        .from("event_tournament_matches")
        .insert(matches)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (_: any, variables) => {
      qc.invalidateQueries({ queryKey: ["tournament-matches", variables.eventId] });
      toast({ title: "Bracket generated" });
    },
    onError: (e: Error) => toast({ title: "Failed to generate bracket", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateMatchResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ matchId, eventId, winnerId, player1Score, player2Score }: {
      matchId: string;
      eventId: string;
      winnerId: string | null;
      player1Score?: number;
      player2Score?: number;
    }) => {
      const { error } = await db
        .from("event_tournament_matches")
        .update({
          winner_id: winnerId,
          player1_score: player1Score ?? null,
          player2_score: player2Score ?? null,
          status: winnerId ? "completed" : "in_progress",
          updated_at: new Date().toISOString(),
        })
        .eq("id", matchId);
      if (error) throw error;
      return { eventId };
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["tournament-matches", data.eventId] });
      qc.invalidateQueries({ queryKey: ["tournament-players", data.eventId] });
    },
  });
}

// ── Bracket Generation Helpers ──────────────────────────────────────────────

export function generateSingleEliminationBracket(
  eventId: string,
  players: TournamentPlayer[]
): Omit<TournamentMatch, "id" | "created_at" | "updated_at">[] {
  const n = players.length;
  if (n < 2) return [];
  
  // Next power of 2
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)));
  const totalRounds = Math.ceil(Math.log2(bracketSize));
  const matches: Omit<TournamentMatch, "id" | "created_at" | "updated_at">[] = [];

  // Seed players
  const seeded = [...players];
  
  // Round 1 matches
  const r1Matches = bracketSize / 2;
  for (let i = 0; i < r1Matches; i++) {
    const p1 = seeded[i] || null;
    const p2 = seeded[bracketSize - 1 - i] || null;
    const isBye = !p1 || !p2;
    
    matches.push({
      event_id: eventId,
      round_number: 1,
      match_number: i + 1,
      bracket_position: "winners",
      player1_id: p1?.id || null,
      player2_id: p2?.id || null,
      winner_id: isBye ? (p1?.id || p2?.id || null) : null,
      player1_score: null,
      player2_score: null,
      status: isBye ? "bye" : "pending",
      scheduled_time: null,
      table_label: null,
      notes: null,
    });
  }

  // Subsequent rounds (empty, filled as results come in)
  let matchesInRound = r1Matches / 2;
  for (let round = 2; round <= totalRounds; round++) {
    for (let i = 0; i < matchesInRound; i++) {
      matches.push({
        event_id: eventId,
        round_number: round,
        match_number: i + 1,
        bracket_position: "winners",
        player1_id: null,
        player2_id: null,
        winner_id: null,
        player1_score: null,
        player2_score: null,
        status: "pending",
        scheduled_time: null,
        table_label: null,
        notes: null,
      });
    }
    matchesInRound = Math.max(1, matchesInRound / 2);
  }

  return matches;
}

export function generateRoundRobinMatches(
  eventId: string,
  players: TournamentPlayer[]
): Omit<TournamentMatch, "id" | "created_at" | "updated_at">[] {
  const n = players.length;
  if (n < 2) return [];
  
  const matches: Omit<TournamentMatch, "id" | "created_at" | "updated_at">[] = [];
  const list = [...players];
  
  // If odd number, add a "bye" placeholder
  if (n % 2 !== 0) {
    list.push(null as any);
  }
  
  const totalRounds = list.length - 1;
  let matchNum = 0;

  for (let round = 0; round < totalRounds; round++) {
    for (let i = 0; i < list.length / 2; i++) {
      const p1 = list[i];
      const p2 = list[list.length - 1 - i];
      
      if (!p1 || !p2) {
        // Bye
        matchNum++;
        matches.push({
          event_id: eventId,
          round_number: round + 1,
          match_number: matchNum,
          bracket_position: null,
          player1_id: (p1 || p2)?.id || null,
          player2_id: null,
          winner_id: (p1 || p2)?.id || null,
          player1_score: null,
          player2_score: null,
          status: "bye",
          scheduled_time: null,
          table_label: null,
          notes: null,
        });
        continue;
      }
      
      matchNum++;
      matches.push({
        event_id: eventId,
        round_number: round + 1,
        match_number: matchNum,
        bracket_position: null,
        player1_id: p1.id,
        player2_id: p2.id,
        winner_id: null,
        player1_score: null,
        player2_score: null,
        status: "pending",
        scheduled_time: null,
        table_label: null,
        notes: null,
      });
    }
    
    // Rotate players (keep first fixed)
    const last = list.pop()!;
    list.splice(1, 0, last);
  }

  return matches;
}

export function generateSwissMatches(
  eventId: string,
  players: TournamentPlayer[],
  roundNumber: number
): Omit<TournamentMatch, "id" | "created_at" | "updated_at">[] {
  // Sort by points (desc), then tiebreaker
  const sorted = [...players].sort((a, b) => b.points - a.points || b.tiebreaker_score - a.tiebreaker_score);
  
  const matches: Omit<TournamentMatch, "id" | "created_at" | "updated_at">[] = [];
  const paired = new Set<string>();
  let matchNum = 0;

  for (let i = 0; i < sorted.length; i++) {
    if (paired.has(sorted[i].id)) continue;
    
    // Find best unpaired opponent
    for (let j = i + 1; j < sorted.length; j++) {
      if (paired.has(sorted[j].id)) continue;
      
      matchNum++;
      paired.add(sorted[i].id);
      paired.add(sorted[j].id);
      
      matches.push({
        event_id: eventId,
        round_number: roundNumber,
        match_number: matchNum,
        bracket_position: null,
        player1_id: sorted[i].id,
        player2_id: sorted[j].id,
        winner_id: null,
        player1_score: null,
        player2_score: null,
        status: "pending",
        scheduled_time: null,
        table_label: null,
        notes: null,
      });
      break;
    }
  }

  // Handle bye for odd player
  const unpairedPlayer = sorted.find(p => !paired.has(p.id));
  if (unpairedPlayer) {
    matchNum++;
    matches.push({
      event_id: eventId,
      round_number: roundNumber,
      match_number: matchNum,
      bracket_position: null,
      player1_id: unpairedPlayer.id,
      player2_id: null,
      winner_id: unpairedPlayer.id,
      player1_score: null,
      player2_score: null,
      status: "bye",
      scheduled_time: null,
      table_label: null,
      notes: null,
    });
  }

  return matches;
}
