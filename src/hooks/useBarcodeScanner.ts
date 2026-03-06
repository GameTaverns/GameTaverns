import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface CatalogBarcode {
  id: string;
  barcode: string;
  barcode_type: string;
  catalog_id: string | null;
  game_id: string | null;
  created_by: string;
  created_at: string;
}

/** Look up a barcode to find the linked game/catalog entry */
export function useBarcodeLookup(barcode: string | null) {
  return useQuery({
    queryKey: ["barcode-lookup", barcode],
    queryFn: async () => {
      if (!barcode) return null;
      const { data, error } = await supabase
        .from("catalog_barcodes")
        .select("*, game:games(id, title, image_url, slug, library_id), catalog:game_catalog(id, title, image_url, slug)")
        .eq("barcode", barcode)
        .maybeSingle();
      if (error) throw error;
      return data as (CatalogBarcode & {
        game?: { id: string; title: string; image_url: string | null; slug: string | null; library_id: string } | null;
        catalog?: { id: string; title: string; image_url: string | null; slug: string | null } | null;
      }) | null;
    },
    enabled: !!barcode && barcode.length >= 8,
  });
}

/** Save a barcode → game/catalog mapping */
export function useSaveBarcode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      barcode: string;
      barcode_type?: string;
      catalog_id?: string;
      game_id?: string;
      created_by: string;
    }) => {
      const { data, error } = await supabase
        .from("catalog_barcodes")
        .upsert(
          {
            barcode: params.barcode,
            barcode_type: params.barcode_type || "UPC",
            catalog_id: params.catalog_id || null,
            game_id: params.game_id || null,
            created_by: params.created_by,
          },
          { onConflict: "barcode" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["barcode-lookup", data.barcode] });
    },
  });
}
