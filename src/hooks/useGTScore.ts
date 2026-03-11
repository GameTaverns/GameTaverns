/**
 * GT Score — GameTavern's Proprietary Composite Rating Algorithm
 *
 * The GT Score is NOT a simple average. It's a weighted composite that
 * considers multiple dimensions of game quality as evaluated by the community:
 *
 * FORMULA:
 *   GT Score = (W_overall × Overall) × ReviewDepthMultiplier × ConfidenceMultiplier
 *
 * Where:
 *   - Overall = Weighted average of reviewer overall ratings (reviewer_weight applied)
 *   - Sub-ratings (gameplay, components, replayability, value) contribute via a
 *     SubRatingAdjustment that can shift the score ±0.5 based on dimensional consensus
 *   - ReviewDepthMultiplier rewards detailed reviews (tags, player count ratings, guided prompts)
 *   - ConfidenceMultiplier applies Bayesian smoothing so games with few reviews
 *     regress toward the platform mean (preventing 1-review 10/10 outliers)
 *   - SentimentBonus: net positive tag ratio adds up to +0.3
 *
 * DUAL SCORING:
 *   Like Rotten Tomatoes, the GT Score splits into two aggregates:
 *   - Owner Score: Reviews from users who own/owned the game (higher weight, always shown)
 *   - Player Score: Reviews from users who've played but don't own (shown when 3+ reviews)
 *   Reviews dynamically reclassify when ownership status changes.
 *
 * WEIGHT FACTORS:
 *   - Play count affects reviewer weight (more plays = higher weight)
 *   - Account age adds weight (6mo+, 1yr+ bonuses)
 *   - Collection size adds weight
 *   - Owner reviews carry a 1.2x multiplier over player reviews
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface GTScoreSegment {
  /** The composite score (1-10 scale) */
  score: number;
  /** Letter grade derived from score */
  grade: string;
  /** Number of reviews contributing */
  reviewCount: number;
  /** Confidence level: 'low' (<3), 'medium' (3-9), 'high' (10+) */
  confidence: "low" | "medium" | "high";
  /** What percentage of reviewers recommend this game */
  recommendRate: number | null;
}

export interface GTScore {
  /** The combined GT Score (1-10 scale) */
  score: number;
  /** Letter grade derived from score */
  grade: string;
  /** Number of reviews contributing */
  reviewCount: number;
  /** Confidence level: 'low' (<3), 'medium' (3-9), 'high' (10+) */
  confidence: "low" | "medium" | "high";
  /** Sub-dimension averages (weighted) */
  dimensions: {
    overall: number;
    gameplay: number | null;
    components: number | null;
    replayability: number | null;
    value: number | null;
  };
  /** What percentage of reviewers recommend this game */
  recommendRate: number | null;
  /** Net sentiment from tags (positive minus negative ratio) */
  sentimentScore: number | null;
  /** Owner Score segment (users who own/owned the game) */
  ownerScore: GTScoreSegment | null;
  /** Player Score segment (users who played but don't own) */
  playerScore: GTScoreSegment | null;
}

// Bayesian prior: platform average and minimum reviews for full confidence
const PRIOR_MEAN = 6.5;
const CONFIDENCE_THRESHOLD = 10; // Reviews needed for full confidence
const OWNER_WEIGHT_MULTIPLIER = 1.2; // Owner reviews count 20% more in combined score

function calculateSegmentScore(
  reviews: ReviewData[],
): GTScoreSegment | null {
  if (!reviews || reviews.length === 0) return null;

  const n = reviews.length;
  const totalWeight = reviews.reduce((sum, r) => sum + r.reviewer_weight, 0);
  const weightedOverall = reviews.reduce((sum, r) => sum + r.rating_overall * r.reviewer_weight, 0) / totalWeight;

  // Bayesian smoothing
  const bayesianScore = (n * weightedOverall + CONFIDENCE_THRESHOLD * PRIOR_MEAN) / (n + CONFIDENCE_THRESHOLD);
  const finalScore = Math.max(1, Math.min(10, Math.round(bayesianScore * 10) / 10));

  const withRecommendation = reviews.filter(r => r.recommended !== null);
  const recommendRate = withRecommendation.length > 0
    ? withRecommendation.filter(r => r.recommended === true).length / withRecommendation.length
    : null;

  const confidence: GTScoreSegment["confidence"] = n < 3 ? "low" : n < 10 ? "medium" : "high";

  return {
    score: finalScore,
    grade: getGrade(finalScore),
    reviewCount: n,
    confidence,
    recommendRate,
  };
}

function calculateGTScore(
  reviews: ReviewData[],
  tagSentiment: { positive: number; negative: number; neutral: number } | null,
  reviewDepthData: { withTags: number; withPlayerCounts: number; withPrompts: number; total: number } | null
): GTScore | null {
  if (!reviews || reviews.length === 0) return null;

  const n = reviews.length;

  // Split reviews by reviewer_type
  const ownerReviews = reviews.filter(r => r.reviewer_type === "owner");
  const playerReviews = reviews.filter(r => r.reviewer_type === "player");

  // Calculate segment scores
  const ownerScore = calculateSegmentScore(ownerReviews);
  const playerScore = calculateSegmentScore(playerReviews);

  // 1. Weighted Overall Rating (with owner multiplier for combined score)
  const totalWeight = reviews.reduce((sum, r) => {
    const multiplier = r.reviewer_type === "owner" ? OWNER_WEIGHT_MULTIPLIER : 1.0;
    return sum + r.reviewer_weight * multiplier;
  }, 0);
  const weightedOverall = reviews.reduce((sum, r) => {
    const multiplier = r.reviewer_type === "owner" ? OWNER_WEIGHT_MULTIPLIER : 1.0;
    return sum + r.rating_overall * r.reviewer_weight * multiplier;
  }, 0) / totalWeight;

  // 2. Sub-rating weighted averages
  const calcDimension = (field: keyof ReviewData): number | null => {
    const valid = reviews.filter(r => r[field] != null && (r[field] as number) > 0);
    if (valid.length === 0) return null;
    const tw = valid.reduce((s, r) => s + r.reviewer_weight, 0);
    return valid.reduce((s, r) => s + (r[field] as number) * r.reviewer_weight, 0) / tw;
  };

  const gameplay = calcDimension("rating_gameplay");
  const components = calcDimension("rating_components");
  const replayability = calcDimension("rating_replayability");
  const value = calcDimension("rating_value");

  // 3. Sub-Rating Adjustment
  let subRatingAdjustment = 0;
  const subRatings = [gameplay, components, replayability, value].filter(v => v !== null) as number[];
  if (subRatings.length > 0) {
    const subAvg = subRatings.reduce((a, b) => a + b, 0) / subRatings.length;
    subRatingAdjustment = Math.max(-0.5, Math.min(0.5, (subAvg - weightedOverall) * 0.25));
  }

  // 4. Review Depth Multiplier
  let depthMultiplier = 1.0;
  if (reviewDepthData && reviewDepthData.total > 0) {
    const tagRatio = reviewDepthData.withTags / reviewDepthData.total;
    const pcRatio = reviewDepthData.withPlayerCounts / reviewDepthData.total;
    const promptRatio = reviewDepthData.withPrompts / reviewDepthData.total;
    depthMultiplier = 1.0 + (tagRatio * 0.02 + pcRatio * 0.015 + promptRatio * 0.015);
  }

  // 5. Sentiment Bonus from tags
  let sentimentBonus = 0;
  let sentimentScore: number | null = null;
  if (tagSentiment && (tagSentiment.positive + tagSentiment.negative) > 0) {
    const totalTags = tagSentiment.positive + tagSentiment.negative + tagSentiment.neutral;
    sentimentScore = (tagSentiment.positive - tagSentiment.negative) / totalTags;
    sentimentBonus = Math.max(-0.3, Math.min(0.3, sentimentScore * 0.3));
  }

  // 6. Bayesian Confidence Smoothing
  const rawScore = (weightedOverall + subRatingAdjustment) * depthMultiplier + sentimentBonus;
  const bayesianScore = (n * rawScore + CONFIDENCE_THRESHOLD * PRIOR_MEAN) / (n + CONFIDENCE_THRESHOLD);

  // Clamp to 1-10
  const finalScore = Math.max(1, Math.min(10, Math.round(bayesianScore * 10) / 10));

  // Recommendation rate
  const withRecommendation = reviews.filter(r => r.recommended !== null);
  const recommendRate = withRecommendation.length > 0
    ? withRecommendation.filter(r => r.recommended === true).length / withRecommendation.length
    : null;

  // Confidence level
  const confidence: GTScore["confidence"] = n < 3 ? "low" : n < 10 ? "medium" : "high";

  // Letter grade
  const grade = getGrade(finalScore);

  return {
    score: finalScore,
    grade,
    reviewCount: n,
    confidence,
    dimensions: {
      overall: Math.round(weightedOverall * 10) / 10,
      gameplay: gameplay ? Math.round(gameplay * 10) / 10 : null,
      components: components ? Math.round(components * 10) / 10 : null,
      replayability: replayability ? Math.round(replayability * 10) / 10 : null,
      value: value ? Math.round(value * 10) / 10 : null,
    },
    recommendRate,
    sentimentScore,
    ownerScore,
    playerScore,
  };
}

function getGrade(score: number): string {
  if (score >= 9.0) return "S";
  if (score >= 8.0) return "A";
  if (score >= 7.0) return "B";
  if (score >= 6.0) return "C";
  if (score >= 5.0) return "D";
  return "F";
}

export function getGradeColor(grade: string): string {
  switch (grade) {
    case "S": return "text-amber-500 bg-amber-500/15 border-amber-500/40";
    case "A": return "text-green-600 dark:text-green-400 bg-green-500/15 border-green-500/30";
    case "B": return "text-primary bg-primary/10 border-primary/30";
    case "C": return "text-amber-600 dark:text-amber-400 bg-amber-500/15 border-amber-500/30";
    case "D": return "text-orange-600 dark:text-orange-400 bg-orange-500/15 border-orange-500/30";
    case "F": return "text-red-600 dark:text-red-400 bg-red-500/15 border-red-500/30";
    default: return "text-muted-foreground bg-muted border-border";
  }
}

export function getScoreLabel(score: number): string {
  if (score >= 9.0) return "Must Own";
  if (score >= 8.0) return "Excellent";
  if (score >= 7.0) return "Very Good";
  if (score >= 6.0) return "Good";
  if (score >= 5.0) return "Average";
  if (score >= 4.0) return "Below Average";
  return "Poor";
}

interface ReviewData {
  rating_overall: number;
  rating_gameplay: number | null;
  rating_components: number | null;
  rating_replayability: number | null;
  rating_value: number | null;
  reviewer_weight: number;
  recommended: boolean | null;
  best_for: string | null;
  skip_if: string | null;
  best_player_count: string | null;
  compared_to: string | null;
  reviewer_type: string;
}

/**
 * Hook: compute the GT Score for a catalog entry
 */
export function useGTScore(catalogId: string | undefined) {
  return useQuery({
    queryKey: ["gt-score", catalogId],
    queryFn: async (): Promise<GTScore | null> => {
      // 1. Fetch all published reviews (now including reviewer_type)
      const { data: reviews, error: revErr } = await supabase
        .from("game_reviews")
        .select("rating_overall, rating_gameplay, rating_components, rating_replayability, rating_value, reviewer_weight, recommended, best_for, skip_if, best_player_count, compared_to, reviewer_type")
        .eq("catalog_id", catalogId!)
        .eq("status", "published");
      if (revErr) throw revErr;
      if (!reviews || reviews.length === 0) return null;

      const reviewIds = await getReviewIds(catalogId!);

      // 2. Tag sentiment
      let tagSentiment: { positive: number; negative: number; neutral: number } | null = null;
      if (reviewIds.length > 0) {
        const { data: tagLinks } = await supabase
          .from("review_tags")
          .select("tag_id")
          .in("review_id", reviewIds);

        if (tagLinks && tagLinks.length > 0) {
          const tagIds = [...new Set(tagLinks.map(t => t.tag_id))];
          const { data: tags } = await supabase
            .from("rating_tags")
            .select("id, is_positive")
            .in("id", tagIds);

          if (tags) {
            const tagMap = Object.fromEntries(tags.map(t => [t.id, t.is_positive]));
            let positive = 0, negative = 0, neutral = 0;
            tagLinks.forEach(tl => {
              const sentiment = tagMap[tl.tag_id];
              if (sentiment === true) positive++;
              else if (sentiment === false) negative++;
              else neutral++;
            });
            tagSentiment = { positive, negative, neutral };
          }
        }
      }

      // 3. Review depth data
      let reviewDepthData = null;
      if (reviewIds.length > 0) {
        const { data: tagCounts } = await supabase
          .from("review_tags")
          .select("review_id")
          .in("review_id", reviewIds);

        const { data: pcCounts } = await supabase
          .from("review_player_count_ratings")
          .select("review_id")
          .in("review_id", reviewIds);

        const withTags = new Set((tagCounts || []).map(t => t.review_id)).size;
        const withPlayerCounts = new Set((pcCounts || []).map(p => p.review_id)).size;
        const withPrompts = reviews.filter(r =>
          r.best_for || r.skip_if || r.best_player_count || r.compared_to
        ).length;

        reviewDepthData = {
          withTags,
          withPlayerCounts,
          withPrompts,
          total: reviews.length,
        };
      }

      return calculateGTScore(reviews as ReviewData[], tagSentiment, reviewDepthData);
    },
    enabled: !!catalogId,
    staleTime: 1000 * 60 * 5,
  });
}

async function getReviewIds(catalogId: string): Promise<string[]> {
  const { data } = await supabase
    .from("game_reviews")
    .select("id")
    .eq("catalog_id", catalogId)
    .eq("status", "published");
  return (data || []).map(r => r.id);
}