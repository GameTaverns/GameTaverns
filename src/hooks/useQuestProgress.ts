import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { QUESTS, getQuestProgress, type Quest } from "@/lib/quests";
import type { AchievementProgress } from "@/hooks/useAchievements";
import { toast } from "sonner";

export function useQuestCompletions() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["quest-completions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from("user_quest_completions")
        .select("*")
        .eq("user_id", user.id);
      if (error) throw error;
      return data as { quest_slug: string; completed_at: string; bonus_points_awarded: number }[];
    },
    enabled: !!user,
  });
}

export function useClaimQuest() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ quest, progress }: { quest: Quest; progress: AchievementProgress }) => {
      if (!user) throw new Error("Not authenticated");
      
      const questProgress = getQuestProgress(quest, progress);
      if (!questProgress.isComplete) throw new Error("Quest not complete");

      const { error } = await (supabase as any)
        .from("user_quest_completions")
        .insert({
          user_id: user.id,
          quest_slug: quest.slug,
          bonus_points_awarded: quest.bonusPoints,
        });

      if (error) {
        if (error.code === "23505") throw new Error("Already claimed");
        throw error;
      }
    },
    onSuccess: (_, { quest }) => {
      toast.success(`🗺️ Quest Complete: ${quest.name}!`, {
        description: `+${quest.bonusPoints} bonus points awarded!`,
      });
      queryClient.invalidateQueries({ queryKey: ["quest-completions"] });
      queryClient.invalidateQueries({ queryKey: ["achievement-leaderboard"] });
    },
    onError: (err: Error) => {
      if (err.message === "Already claimed") {
        toast.info("Quest already claimed!");
      } else {
        toast.error("Failed to claim quest reward");
      }
    },
  });
}
