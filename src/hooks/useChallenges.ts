import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "./useAuth";

export type ChallengeType =
  | "play_count"
  | "unique_games"
  | "specific_game"
  | "high_score"
  | "most_plays"
  | "most_unique";

export type ChallengeStatus = "draft" | "active" | "completed" | "cancelled";

export interface Challenge {
  id: string;
  library_id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  challenge_type: ChallengeType;
  target_game_id: string | null;
  target_game?: { id: string; title: string; image_url: string | null } | null;
  target_value: number;
  start_date: string;
  end_date: string;
  status: ChallengeStatus;
  created_at: string;
  updated_at: string;
  participant_count?: number;
}

export interface ChallengeParticipant {
  id: string;
  challenge_id: string;
  user_id: string;
  joined_at: string;
  current_progress: number;
  completed_at: string | null;
  user_profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

// Note: These tables only exist in self-hosted deployments
// We use raw queries with type casting to avoid TypeScript errors

export function useChallenges(libraryId: string | null) {
  return useQuery({
    queryKey: ["challenges", libraryId],
    queryFn: async () => {
      if (!libraryId) return [];

      // Use rpc or raw query to avoid type issues with self-hosted only tables
      const { data, error } = await (supabase as any)
        .from("library_challenges")
        .select(`
          *,
          target_game:games(id, title, image_url)
        `)
        .eq("library_id", libraryId)
        .order("created_at", { ascending: false });

      if (error) {
        // Table doesn't exist in cloud - return empty
        if (error.code === "42P01") return [];
        throw error;
      }
      return (data || []) as Challenge[];
    },
    enabled: !!libraryId,
  });
}

export function useActiveChallenges(libraryId: string | null) {
  return useQuery({
    queryKey: ["active-challenges", libraryId],
    queryFn: async () => {
      if (!libraryId) return [];

      const now = new Date().toISOString();
      const { data, error } = await (supabase as any)
        .from("library_challenges")
        .select(`
          *,
          target_game:games(id, title, image_url)
        `)
        .eq("library_id", libraryId)
        .eq("status", "active")
        .gte("end_date", now)
        .order("end_date", { ascending: true });

      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }
      return (data || []) as Challenge[];
    },
    enabled: !!libraryId,
  });
}

export function useChallengeParticipants(challengeId: string | null) {
  return useQuery({
    queryKey: ["challenge-participants", challengeId],
    queryFn: async () => {
      if (!challengeId) return [];

      const { data, error } = await (supabase as any)
        .from("challenge_participants")
        .select(`
          *,
          user_profile:user_profiles(display_name, avatar_url)
        `)
        .eq("challenge_id", challengeId)
        .order("current_progress", { ascending: false });

      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }
      return (data || []) as ChallengeParticipant[];
    },
    enabled: !!challengeId,
  });
}

export function useCreateChallenge() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (challenge: {
      library_id: string;
      title: string;
      description?: string;
      challenge_type: ChallengeType;
      target_game_id?: string | null;
      target_value: number;
      start_date: string;
      end_date: string;
      status?: ChallengeStatus;
    }) => {
      if (!user) throw new Error("Must be logged in");

      const { data, error } = await (supabase as any)
        .from("library_challenges")
        .insert({
          ...challenge,
          created_by: user.id,
          status: challenge.status || "draft",
        })
        .select()
        .single();

      if (error) throw error;
      return data as Challenge;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["challenges", variables.library_id] });
      queryClient.invalidateQueries({ queryKey: ["active-challenges", variables.library_id] });
    },
  });
}

export function useUpdateChallenge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      libraryId,
      updates,
    }: {
      id: string;
      libraryId: string;
      updates: Partial<Challenge>;
    }) => {
      const { data, error } = await (supabase as any)
        .from("library_challenges")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, library_id: libraryId } as Challenge;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["challenges", data.library_id] });
      queryClient.invalidateQueries({ queryKey: ["active-challenges", data.library_id] });
    },
  });
}

export function useJoinChallenge() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (challengeId: string) => {
      if (!user) throw new Error("Must be logged in");

      const { data, error } = await (supabase as any)
        .from("challenge_participants")
        .insert({
          challenge_id: challengeId,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ChallengeParticipant;
    },
    onSuccess: (_, challengeId) => {
      queryClient.invalidateQueries({ queryKey: ["challenge-participants", challengeId] });
    },
  });
}

export function useLeaveChallenge() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (challengeId: string) => {
      if (!user) throw new Error("Must be logged in");

      const { error } = await (supabase as any)
        .from("challenge_participants")
        .delete()
        .eq("challenge_id", challengeId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: (_, challengeId) => {
      queryClient.invalidateQueries({ queryKey: ["challenge-participants", challengeId] });
    },
  });
}
