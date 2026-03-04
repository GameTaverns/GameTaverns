import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface LibraryViewStats {
  views_7d: number;
  views_30d: number;
  unique_viewers_7d: number;
  unique_viewers_30d: number;
  views_total: number;
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

      if (error) throw error;
      return data ?? {
        views_7d: 0,
        views_30d: 0,
        unique_viewers_7d: 0,
        unique_viewers_30d: 0,
        views_total: 0,
      };
    },
    enabled: !!libraryId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
