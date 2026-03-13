import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export function useCatalogGenres(catalogId: string | null | undefined) {
  return useQuery({
    queryKey: ["catalog-genres", catalogId],
    queryFn: async (): Promise<string[]> => {
      if (!catalogId) return [];
      const { data, error } = await (supabase as any)
        .from("catalog_genres")
        .select("genre")
        .eq("catalog_id", catalogId)
        .order("genre");
      if (error) throw error;
      return (data || []).map((r: { genre: string }) => r.genre);
    },
    enabled: !!catalogId,
  });
}

export function useSetCatalogGenres() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { catalogId: string; genres: string[] }) => {
      const { catalogId, genres } = params;
      // Delete existing
      await (supabase as any).from("catalog_genres").delete().eq("catalog_id", catalogId);
      // Insert new
      if (genres.length > 0) {
        const rows = genres.map(g => ({ catalog_id: catalogId, genre: g }));
        const { error } = await (supabase as any).from("catalog_genres").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: (_: unknown, v: { catalogId: string; genres: string[] }) => {
      qc.invalidateQueries({ queryKey: ["catalog-genres", v.catalogId] });
      qc.invalidateQueries({ queryKey: ["catalog-game"] });
    },
  });
}
