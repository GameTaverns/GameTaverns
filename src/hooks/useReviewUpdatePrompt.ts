/**
 * Hook: Determines if a user should be prompted to update their review
 * based on play count milestones (every 5 plays since last prompt).
 * Also handles the "added to library" ownership reclassification prompt.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";

const PLAYS_BETWEEN_PROMPTS = 5;

interface ReviewUpdatePrompt {
  shouldPrompt: boolean;
  reason: "play_milestone" | "ownership_changed" | null;
  reviewId: string | null;
  currentPlayCount: number;
  playsAtLastPrompt: number;
  currentOwnershipStatus: string | null;
  reviewerType: string | null;
}

/**
 * Check if user should be prompted to update their review for a catalog entry.
 * Call after logging a play session.
 */
export function useReviewUpdatePrompt(catalogId: string | undefined, currentPlayCount?: number) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["review-update-prompt", catalogId, user?.id, currentPlayCount],
    queryFn: async (): Promise<ReviewUpdatePrompt> => {
      // Get user's existing review
      const { data: review } = await supabase
        .from("game_reviews")
        .select("id, plays_at_last_prompt, reviewer_type, ownership_status, play_count_at_review")
        .eq("catalog_id", catalogId!)
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!review) {
        return {
          shouldPrompt: false,
          reason: null,
          reviewId: null,
          currentPlayCount: currentPlayCount || 0,
          playsAtLastPrompt: 0,
          currentOwnershipStatus: null,
          reviewerType: null,
        };
      }

      const plays = currentPlayCount || review.play_count_at_review || 0;
      const lastPrompt = review.plays_at_last_prompt || 0;
      const playsSincePrompt = plays - lastPrompt;

      // Check if play milestone reached
      if (playsSincePrompt >= PLAYS_BETWEEN_PROMPTS) {
        return {
          shouldPrompt: true,
          reason: "play_milestone",
          reviewId: review.id,
          currentPlayCount: plays,
          playsAtLastPrompt: lastPrompt,
          currentOwnershipStatus: review.ownership_status,
          reviewerType: review.reviewer_type,
        };
      }

      return {
        shouldPrompt: false,
        reason: null,
        reviewId: review.id,
        currentPlayCount: plays,
        playsAtLastPrompt: lastPrompt,
        currentOwnershipStatus: review.ownership_status,
        reviewerType: review.reviewer_type,
      };
    },
    enabled: !!catalogId && !!user?.id,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Dismiss the review update prompt (updates plays_at_last_prompt)
 */
export function useDismissReviewPrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reviewId, currentPlayCount }: { reviewId: string; currentPlayCount: number }) => {
      const { error } = await supabase
        .from("game_reviews")
        .update({ plays_at_last_prompt: currentPlayCount })
        .eq("id", reviewId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review-update-prompt"] });
    },
  });
}

/**
 * Reclassify a review from player to owner (when user adds game to library)
 */
export function useReclassifyReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reviewId }: { reviewId: string }) => {
      const { error } = await supabase
        .from("game_reviews")
        .update({
          reviewer_type: "owner",
          ownership_status: "owned",
        })
        .eq("id", reviewId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review-update-prompt"] });
      queryClient.invalidateQueries({ queryKey: ["gt-score"] });
      queryClient.invalidateQueries({ queryKey: ["game-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["my-review"] });
    },
  });
}