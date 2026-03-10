import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface RatingTag {
  id: string;
  slug: string;
  label: string;
  category: string;
  icon: string | null;
  is_positive: boolean | null;
  display_order: number;
}

export interface ReviewTag {
  id: string;
  review_id: string;
  tag_id: string;
}

export interface PlayerCountRating {
  id: string;
  review_id: string;
  player_count: number;
  rating: number;
  notes: string | null;
}

// Fetch all predefined rating tags
export function useRatingTags() {
  return useQuery({
    queryKey: ["rating-tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rating_tags")
        .select("id, slug, label, category, icon, is_positive, display_order")
        .order("display_order")
        .throwOnError();
      if (error) throw error;
      return (data || []) as RatingTag[];
    },
    staleTime: 0, // Always refetch to ensure fresh data
    gcTime: 1000 * 60 * 2, // 2 minutes garbage collection
  });
}

// Fetch tags for a specific review
export function useReviewTags(reviewId: string | undefined) {
  return useQuery({
    queryKey: ["review-tags", reviewId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("review_tags")
        .select("id, review_id, tag_id")
        .eq("review_id", reviewId!);
      if (error) throw error;
      return (data || []) as ReviewTag[];
    },
    enabled: !!reviewId,
  });
}

// Fetch tags aggregated across all reviews for a catalog entry
export function useCatalogTagAggregation(catalogId: string | undefined) {
  return useQuery({
    queryKey: ["catalog-tag-aggregation", catalogId],
    queryFn: async () => {
      // Get all review IDs for this catalog entry
      const { data: reviews, error: reviewErr } = await supabase
        .from("game_reviews")
        .select("id")
        .eq("catalog_id", catalogId!)
        .eq("status", "published");
      if (reviewErr) throw reviewErr;
      if (!reviews || reviews.length === 0) return [];

      const reviewIds = reviews.map(r => r.id);

      // Get all tags linked to those reviews
      const { data: reviewTags, error: tagErr } = await supabase
        .from("review_tags")
        .select("tag_id")
        .in("review_id", reviewIds);
      if (tagErr) throw tagErr;

      // Count frequency
      const counts: Record<string, number> = {};
      (reviewTags || []).forEach(rt => {
        counts[rt.tag_id] = (counts[rt.tag_id] || 0) + 1;
      });

      return Object.entries(counts)
        .map(([tag_id, count]) => ({ tag_id, count, percentage: Math.round((count / reviews.length) * 100) }))
        .sort((a, b) => b.count - a.count);
    },
    enabled: !!catalogId,
  });
}

// Fetch player count ratings aggregated for a catalog entry
export function useCatalogPlayerCountRatings(catalogId: string | undefined) {
  return useQuery({
    queryKey: ["catalog-pc-ratings", catalogId],
    queryFn: async () => {
      const { data: reviews, error: reviewErr } = await supabase
        .from("game_reviews")
        .select("id")
        .eq("catalog_id", catalogId!)
        .eq("status", "published");
      if (reviewErr) throw reviewErr;
      if (!reviews || reviews.length === 0) return [];

      const reviewIds = reviews.map(r => r.id);

      const { data, error } = await supabase
        .from("review_player_count_ratings")
        .select("player_count, rating")
        .in("review_id", reviewIds);
      if (error) throw error;

      // Aggregate by player count
      const agg: Record<number, { total: number; count: number }> = {};
      (data || []).forEach(r => {
        if (!agg[r.player_count]) agg[r.player_count] = { total: 0, count: 0 };
        agg[r.player_count].total += r.rating;
        agg[r.player_count].count += 1;
      });

      return Object.entries(agg)
        .map(([pc, v]) => ({
          player_count: parseInt(pc),
          average: Math.round((v.total / v.count) * 10) / 10,
          votes: v.count,
        }))
        .sort((a, b) => a.player_count - b.player_count);
    },
    enabled: !!catalogId,
  });
}

// Fetch player count ratings for a specific review
export function useReviewPlayerCountRatings(reviewId: string | undefined) {
  return useQuery({
    queryKey: ["review-pc-ratings", reviewId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("review_player_count_ratings")
        .select("*")
        .eq("review_id", reviewId!);
      if (error) throw error;
      return (data || []) as PlayerCountRating[];
    },
    enabled: !!reviewId,
  });
}

// Save review tags + player count ratings after review submission
export function useSaveReviewExtras() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reviewId,
      catalogId,
      tagIds,
      playerCountRatings,
    }: {
      reviewId: string;
      catalogId: string;
      tagIds: string[];
      playerCountRatings: { player_count: number; rating: number }[];
    }) => {
      // Delete existing tags and re-insert
      await supabase.from("review_tags").delete().eq("review_id", reviewId);
      if (tagIds.length > 0) {
        const { error: tagErr } = await supabase
          .from("review_tags")
          .insert(tagIds.map(tag_id => ({ review_id: reviewId, tag_id })));
        if (tagErr) throw tagErr;
      }

      // Delete existing player count ratings and re-insert
      await supabase.from("review_player_count_ratings").delete().eq("review_id", reviewId);
      if (playerCountRatings.length > 0) {
        const { error: pcErr } = await supabase
          .from("review_player_count_ratings")
          .insert(playerCountRatings.map(pc => ({ review_id: reviewId, ...pc })));
        if (pcErr) throw pcErr;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["review-tags"] });
      queryClient.invalidateQueries({ queryKey: ["review-pc-ratings"] });
      queryClient.invalidateQueries({ queryKey: ["catalog-tag-aggregation", vars.catalogId] });
      queryClient.invalidateQueries({ queryKey: ["catalog-pc-ratings", vars.catalogId] });
    },
  });
}
