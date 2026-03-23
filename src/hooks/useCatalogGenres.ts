import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface CatalogGenreEntry {
  genre: string;
  display_order: number;
}

export function useCatalogGenres(catalogId: string | null | undefined) {
  return useQuery({
    queryKey: ["catalog-genres", catalogId],
    queryFn: async (): Promise<CatalogGenreEntry[]> => {
      if (!catalogId) return [];
      const { data, error } = await (supabase as any)
        .from("catalog_genres")
        .select("genre, display_order")
        .eq("catalog_id", catalogId)
        .order("display_order");
      if (error) throw error;
      return (data || []).map((r: { genre: string; display_order: number }) => ({
        genre: r.genre,
        display_order: r.display_order,
      }));
    },
    enabled: !!catalogId,
  });
}

/** Returns just the genre strings in priority order (convenience) */
export function useCatalogGenreNames(catalogId: string | null | undefined) {
  const query = useCatalogGenres(catalogId);
  return {
    ...query,
    data: query.data?.map((g) => g.genre) ?? [],
  };
}

export function useSetCatalogGenres() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { catalogId: string; genres: string[] }) => {
      const { catalogId, genres } = params;
      // Delete existing
      await (supabase as any).from("catalog_genres").delete().eq("catalog_id", catalogId);
      // Insert new with display_order based on array index
      if (genres.length > 0) {
        const rows = genres.map((g, i) => ({
          catalog_id: catalogId,
          genre: g,
          display_order: i,
        }));
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
