import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface FeedbackRating {
  id: string;
  loan_id: string;
  rated_by_user_id: string;
  rated_user_id: string;
  rating: number;
  review: string | null;
  created_at: string;
  // enriched
  rated_by_display_name?: string | null;
  rated_by_username?: string | null;
  game_title?: string | null;
  role: "borrower" | "lender"; // from the rated user's perspective
}

export interface FeedbackSummary {
  asLender: FeedbackRating[];
  asBorrower: FeedbackRating[];
  given: FeedbackRating[];
  avgLender: number | null;
  avgBorrower: number | null;
  totalCount: number;
}

export function useUserFeedback(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-feedback", userId],
    queryFn: async (): Promise<FeedbackSummary> => {
      if (!userId) return { asLender: [], asBorrower: [], given: [], avgLender: null, avgBorrower: null, totalCount: 0 };

      // Fetch all ratings involving this user
      const [receivedRes, givenRes] = await Promise.all([
        // Ratings received by this user
        (supabase as any)
          .from("borrower_ratings")
          .select("*, game_loans(game_id, lender_user_id, borrower_user_id)")
          .eq("rated_user_id", userId)
          .order("created_at", { ascending: false }),
        // Ratings this user gave to others
        (supabase as any)
          .from("borrower_ratings")
          .select("*, game_loans(game_id, lender_user_id, borrower_user_id)")
          .eq("rated_by_user_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      const received: any[] = receivedRes.data || [];
      const given: any[] = givenRes.data || [];

      // Collect user IDs for profile enrichment
      const raterIds = [...new Set([
        ...received.map((r: any) => r.rated_by_user_id),
        ...given.map((r: any) => r.rated_user_id),
      ])];

      // Collect game IDs
      const gameIds = [...new Set([
        ...received.map((r: any) => r.game_loans?.game_id).filter(Boolean),
        ...given.map((r: any) => r.game_loans?.game_id).filter(Boolean),
      ])];

      const [profilesRes, gamesRes] = await Promise.all([
        raterIds.length > 0
          ? (supabase as any).from("user_profiles").select("user_id, display_name, username").in("user_id", raterIds)
          : Promise.resolve({ data: [] }),
        gameIds.length > 0
          ? (supabase as any).from("games").select("id, title").in("id", gameIds)
          : Promise.resolve({ data: [] }),
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p]));
      const gameMap = new Map((gamesRes.data || []).map((g: any) => [g.id, g.title]));

      const enrich = (r: any, role: "borrower" | "lender"): FeedbackRating => ({
        id: r.id,
        loan_id: r.loan_id,
        rated_by_user_id: r.rated_by_user_id,
        rated_user_id: r.rated_user_id,
        rating: r.rating,
        review: r.review ?? null,
        created_at: r.created_at,
      rated_by_display_name: (profileMap.get(r.rated_by_user_id) as any)?.display_name ?? null,
        rated_by_username: (profileMap.get(r.rated_by_user_id) as any)?.username ?? null,
        game_title: (gameMap.get(r.game_loans?.game_id) as string | undefined) ?? null,
        role,
      });

      // From the rated user's perspective:
      // - If lender_user_id === userId → they were the lender → this rating is "as lender"
      // - If borrower_user_id === userId → they were the borrower → this rating is "as borrower"
      const asLender: FeedbackRating[] = [];
      const asBorrower: FeedbackRating[] = [];

      for (const r of received) {
        const lenderId = r.game_loans?.lender_user_id;
        if (lenderId === userId) {
          asLender.push(enrich(r, "lender"));
        } else {
          asBorrower.push(enrich(r, "borrower"));
        }
      }

      const givenEnriched: FeedbackRating[] = given.map((r: any) => enrich(r, "borrower"));

      const avg = (arr: FeedbackRating[]) =>
        arr.length === 0 ? null : Math.round((arr.reduce((s, r) => s + r.rating, 0) / arr.length) * 10) / 10;

      return {
        asLender,
        asBorrower,
        given: givenEnriched,
        avgLender: avg(asLender),
        avgBorrower: avg(asBorrower),
        totalCount: asLender.length + asBorrower.length,
      };
    },
    enabled: !!userId,
  });
}
