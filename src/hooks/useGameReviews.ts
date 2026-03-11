import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";

export interface GameReview {
  id: string;
  user_id: string;
  catalog_id: string;
  rating_overall: number;
  rating_gameplay: number | null;
  rating_components: number | null;
  rating_replayability: number | null;
  rating_value: number | null;
  title: string | null;
  content: string;
  recommended: boolean | null;
  play_count_at_review: number | null;
  ownership_status: string;
  reviewer_weight: number;
  helpful_count: number;
  unhelpful_count: number;
  status: string;
  best_for: string | null;
  skip_if: string | null;
  best_player_count: string | null;
  compared_to: string | null;
  created_at: string;
  updated_at: string;
  user_profile?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

export interface ReviewFormData {
  catalog_id: string;
  game_id?: string;
  rating_overall: number;
  rating_gameplay?: number;
  rating_components?: number;
  rating_replayability?: number;
  rating_value?: number;
  title?: string;
  content: string;
  recommended?: boolean;
  play_count_at_review?: number;
  ownership_status: "owned" | "previously_owned" | "played_only";
  best_for?: string;
  skip_if?: string;
  best_player_count?: string;
  compared_to?: string;
}

export function useGameReviews(catalogId: string | undefined) {
  return useQuery({
    queryKey: ["game-reviews", catalogId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_reviews")
        .select(`
          id, user_id, catalog_id, rating_overall, rating_gameplay, 
          rating_components, rating_replayability, rating_value,
          title, content, recommended, play_count_at_review,
          ownership_status, reviewer_weight, helpful_count, unhelpful_count,
          status, best_for, skip_if, best_player_count, compared_to,
          created_at, updated_at
        `)
        .eq("catalog_id", catalogId!)
        .eq("status", "published")
        .order("helpful_count", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user profiles for reviews
      const userIds = [...new Set((data || []).map(r => r.user_id))];
      let profileMap: Record<string, any> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("user_id, display_name, username, avatar_url")
          .in("user_id", userIds);

        (profiles || []).forEach(p => {
          profileMap[p.user_id] = p;
        });
      }

      return (data || []).map(r => ({
        ...r,
        user_profile: profileMap[r.user_id] || null,
      })) as GameReview[];
    },
    enabled: !!catalogId,
  });
}

export function useMyReview(catalogId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-review", catalogId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_reviews")
        .select("*")
        .eq("catalog_id", catalogId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error && (error as any).code !== "PGRST116") throw error;
      return data as GameReview | null;
    },
    enabled: !!catalogId && !!user?.id,
  });
}

export function useReviewAggregate(catalogId: string | undefined) {
  return useQuery({
    queryKey: ["review-aggregate", catalogId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_reviews")
        .select("rating_overall, reviewer_weight, rating_gameplay, rating_components, rating_replayability, rating_value")
        .eq("catalog_id", catalogId!)
        .eq("status", "published");

      if (error) throw error;
      if (!data || data.length === 0) return null;

      const totalWeight = data.reduce((sum, r) => sum + r.reviewer_weight, 0);
      const weightedOverall = data.reduce((sum, r) => sum + r.rating_overall * r.reviewer_weight, 0) / totalWeight;

      const calcWeightedAvg = (field: keyof typeof data[0]) => {
        const valid = data.filter(r => r[field] != null);
        if (valid.length === 0) return null;
        const tw = valid.reduce((s, r) => s + r.reviewer_weight, 0);
        return valid.reduce((s, r) => s + (r[field] as number) * r.reviewer_weight, 0) / tw;
      };

      return {
        overall: Math.round(weightedOverall * 10) / 10,
        gameplay: calcWeightedAvg("rating_gameplay"),
        components: calcWeightedAvg("rating_components"),
        replayability: calcWeightedAvg("rating_replayability"),
        value: calcWeightedAvg("rating_value"),
        count: data.length,
      };
    },
    enabled: !!catalogId,
  });
}

export function useSubmitReview() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ReviewFormData) => {
      if (!user) throw new Error("Must be logged in");

      const reviewer_type = data.ownership_status === "played_only" ? "player" : "owner";
      const payload = {
        ...data,
        user_id: user.id,
        reviewer_type,
      };

      // Try upsert (one review per user per game)
      const { error } = await supabase
        .from("game_reviews")
        .upsert(payload, { onConflict: "user_id,catalog_id" });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["game-reviews", variables.catalog_id] });
      queryClient.invalidateQueries({ queryKey: ["my-review", variables.catalog_id] });
      queryClient.invalidateQueries({ queryKey: ["review-aggregate", variables.catalog_id] });
    },
  });
}

export function useReviewVote() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reviewId, voteType }: { reviewId: string; voteType: "helpful" | "unhelpful" }) => {
      if (!user) throw new Error("Must be logged in");

      // Check existing vote
      const { data: existing } = await supabase
        .from("game_review_votes")
        .select("id, vote_type")
        .eq("review_id", reviewId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase.from("game_review_votes").delete().eq("id", existing.id);
        if (existing.vote_type === voteType) return; // Toggle off
      }

      const { error } = await supabase
        .from("game_review_votes")
        .insert({ review_id: reviewId, user_id: user.id, vote_type: voteType });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-reviews"] });
    },
  });
}
