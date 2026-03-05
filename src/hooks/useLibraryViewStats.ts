import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface LibraryViewStats {
  views_7d: number;
  views_30d: number;
  unique_viewers_7d: number;
  unique_viewers_30d: number;
  views_total: number;
}

const EMPTY_STATS: LibraryViewStats = {
  views_7d: 0,
  views_30d: 0,
  unique_viewers_7d: 0,
  unique_viewers_30d: 0,
  views_total: 0,
};

function isMissingRelationError(error: any): boolean {
  const code = error?.code;
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01" || message.includes("does not exist") || message.includes("not found");
}

export function useLibraryViewStats(libraryId: string | undefined) {
  return useQuery({
    queryKey: ["library-view-stats", libraryId],
    queryFn: async (): Promise<LibraryViewStats> => {
      const { data, error } = await supabase
        .from("library_view_stats")
        .select("*")
        .eq("library_id", libraryId!)
        .maybeSingle();

      if (error) {
        if (isMissingRelationError(error)) return EMPTY_STATS;
        throw error;
      }

      return {
        views_7d: data?.views_7d ?? 0,
        views_30d: data?.views_30d ?? 0,
        unique_viewers_7d: data?.unique_viewers_7d ?? 0,
        unique_viewers_30d: data?.unique_viewers_30d ?? 0,
        views_total: data?.views_total ?? 0,
      };
    },
    enabled: !!libraryId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
