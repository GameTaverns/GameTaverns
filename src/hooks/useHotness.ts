import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface HotGame {
  game_id: string;
  title: string;
  image_url: string | null;
  slug: string | null;
  library_id: string | null;
  min_players: number | null;
  max_players: number | null;
  play_time: string | null;
  catalog_id: string | null;
  hotness_score: number;
  recent_plays: number;
  recent_wishes: number;
  recent_ratings: number;
}

export function useHotness(libraryId?: string | null, limit = 10) {
  return useQuery({
    queryKey: ["hotness", libraryId, limit],
    queryFn: async (): Promise<HotGame[]> => {
      let q = (supabase as any)
        .from("game_hotness")
        .select("*")
        .order("hotness_score", { ascending: false })
        .limit(limit);

      if (libraryId) {
        q = q.eq("library_id", libraryId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as HotGame[];
    },
    staleTime: 1000 * 60 * 5, // 5 min cache
  });
}
